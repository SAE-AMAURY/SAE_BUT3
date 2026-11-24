import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import * as arenaModule from '../routes/arena.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

process.env.NODE_ENV = 'test';
const { app } = await import('../index.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const initSqlPath = path.resolve(__dirname, '../db/init.sql');
const initSql = fs.readFileSync(initSqlPath, 'utf8');

const SAMPLE_BASE_CLASS = {
  class_id: 1,
  name: 'Guerrier',
  description: 'Combattant polyvalent.',
  base_health: 100,
  base_range: 1,
  base_damage: 25,
  base_action_points: 3,
  available_functions: [],
  required_mission_id: null,
};

const SAMPLE_LOCKED_CLASS = {
  class_id: 4,
  name: 'CyberNinja',
  description: 'Classe débloquable via mission.',
  base_health: 85,
  base_range: 2,
  base_damage: 30,
  base_action_points: 4,
  available_functions: [],
  required_mission_id: 2,
};

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function sendHttpRequest(baseUrl, method, pathname, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, baseUrl);
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const headers = {};

    if (payload !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const req = http.request(url, { method, headers }, (res) => {
      let raw = '';
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = raw;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', reject);
    if (payload !== null) {
      req.write(payload);
    }
    req.end();
  });
}

describe('Sprint 5 - Issue #33 : Sélection de classe pour le prochain match', () => {
  describe('Schéma SQL de la table "user" (init.sql)', () => {
    it('ajoute selected_class_id et la clé étrangère fk_user_selected_class de manière idempotente', () => {
      const createUserMatch = initSql.match(
        /CREATE TABLE IF NOT EXISTS "user"\s*\(([\s\S]*?)\);/
      );
      assert.ok(createUserMatch, 'Table "user" introuvable dans init.sql');
      assert.ok(createUserMatch[1].includes('selected_class_id INT'));

      assert.ok(
        initSql.includes(
          'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS selected_class_id INT'
        )
      );
      assert.ok(initSql.includes('fk_user_selected_class'));
    });
  });

  describe('createSelectClassHandler (POST/PUT /classes/select)', () => {
    it('rejette un class_id manquant ou invalide avec HTTP 400 sans requêter la DB', async () => {
      assert.equal(typeof arenaModule.createSelectClassHandler, 'function');

      let queryCalled = false;
      const fakeDb = {
        async query() {
          queryCalled = true;
          return { rows: [] };
        },
      };

      const handler = arenaModule.createSelectClassHandler(fakeDb);
      const invalidBodies = [
        undefined,
        {},
        { class_id: null },
        { class_id: 'abc' },
        { class_id: 0 },
        { class_id: -1 },
        { class_id: 1.5 },
      ];

      for (const body of invalidBodies) {
        const res = createMockRes();
        await handler({ user: { player_id: 7 }, body }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(typeof res.body.error, 'string');
      }
      assert.equal(queryCalled, false);
    });

    it('retourne HTTP 404 si la classe demandée est introuvable', async () => {
      assert.equal(typeof arenaModule.createSelectClassHandler, 'function');

      const fakeDb = {
        async query() {
          return { rows: [] };
        },
      };

      const handler = arenaModule.createSelectClassHandler(fakeDb);
      const res = createMockRes();
      await handler({ user: { player_id: 7 }, body: { class_id: 999 } }, res);

      assert.equal(res.statusCode, 404);
      assert.equal(typeof res.body.error, 'string');
    });

    it('retourne HTTP 403 si la classe requiert une mission et n’est pas débloquée', async () => {
      assert.equal(typeof arenaModule.createSelectClassHandler, 'function');

      let step = 0;
      const fakeDb = {
        async query(sql, params) {
          step += 1;
          if (step === 1) {
            assert.deepEqual(params, [4]);
            return { rows: [SAMPLE_LOCKED_CLASS] };
          }
          assert.ok(sql.includes('FROM player_unlock'));
          assert.deepEqual(params, [7, 4]);
          return { rows: [] };
        },
      };

      const handler = arenaModule.createSelectClassHandler(fakeDb);
      const res = createMockRes();
      await handler({ user: { player_id: 7 }, body: { class_id: 4 } }, res);

      assert.equal(res.statusCode, 403);
      assert.equal(typeof res.body.error, 'string');
    });

    it('enregistre la sélection (HTTP 200) pour une classe verrouillée déjà débloquée', async () => {
      assert.equal(typeof arenaModule.createSelectClassHandler, 'function');

      let step = 0;
      const fakeDb = {
        async query(sql, params) {
          step += 1;
          if (step === 1) {
            return { rows: [SAMPLE_LOCKED_CLASS] };
          }
          if (step === 2) {
            assert.ok(sql.includes('FROM player_unlock'));
            return { rows: [{ '?column?': 1 }] };
          }
          assert.ok(sql.includes('UPDATE "user"'));
          assert.deepEqual(params, [4, 7]);
          return { rows: [{ player_id: 7, selected_class_id: 4 }] };
        },
      };

      const handler = arenaModule.createSelectClassHandler(fakeDb);
      const res = createMockRes();
      await handler({ user: { player_id: 7 }, body: { class_id: 4 } }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.selected_class_id, 4);
      assert.equal(res.body.selected_class.name, 'CyberNinja');
    });

    it('enregistre la sélection (HTTP 200) pour une classe de base et renvoie 404 si joueur absent', async () => {
      assert.equal(typeof arenaModule.createSelectClassHandler, 'function');

      const calls = [];
      const fakeDb = {
        async query(sql, params) {
          calls.push({ sql, params });
          if (calls.length === 1) {
            return { rows: [SAMPLE_BASE_CLASS] };
          }
          return { rows: [{ player_id: 7, selected_class_id: 1 }] };
        },
      };

      const handler = arenaModule.createSelectClassHandler(fakeDb);
      const res = createMockRes();
      await handler({ user: { player_id: 7 }, body: { class_id: 1 } }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(calls.length, 2);
      assert.ok(calls[1].sql.includes('UPDATE "user"'));
      assert.deepEqual(calls[1].params, [1, 7]);
      assert.equal(res.body.selected_class_id, 1);
      assert.equal(res.body.selected_class.stats.health, 100);

      let missingStep = 0;
      const missingUserHandler = arenaModule.createSelectClassHandler({
        async query() {
          missingStep += 1;
          return missingStep === 1 ? { rows: [SAMPLE_BASE_CLASS] } : { rows: [] };
        },
      });
      const resMissing = createMockRes();
      await missingUserHandler(
        { user: { player_id: 999 }, body: { class_id: 1 } },
        resMissing
      );
      assert.equal(resMissing.statusCode, 404);
    });

    it('retourne HTTP 500 sans fuite technique sur erreur PostgreSQL', async () => {
      assert.equal(typeof arenaModule.createSelectClassHandler, 'function');

      const handler = arenaModule.createSelectClassHandler({
        async query() {
          throw new Error('pg secret host unreachable');
        },
      });
      const res = createMockRes();
      await handler({ user: { player_id: 7 }, body: { class_id: 1 } }, res);

      assert.equal(res.statusCode, 500);
      assert.ok(!res.body.error.includes('pg secret'));
    });
  });

  describe('createGetSelectedClassHandler (GET /classes/selected)', () => {
    it('retourne HTTP 200 avec la classe sélectionnée formatée', async () => {
      assert.equal(typeof arenaModule.createGetSelectedClassHandler, 'function');

      const calls = [];
      const handler = arenaModule.createGetSelectedClassHandler({
        async query(sql, params) {
          calls.push({ sql, params });
          return {
            rows: [{ selected_class_id: 1, ...SAMPLE_BASE_CLASS }],
          };
        },
      });
      const res = createMockRes();
      await handler({ user: { player_id: 7 } }, res);

      assert.equal(res.statusCode, 200);
      assert.ok(calls[0].sql.includes('LEFT JOIN class'));
      assert.deepEqual(calls[0].params, [7]);
      assert.equal(res.body.selected_class_id, 1);
      assert.equal(res.body.selected_class.name, 'Guerrier');
    });

    it('retourne HTTP 200 avec null si aucune classe sélectionnée et 404 si joueur absent', async () => {
      assert.equal(typeof arenaModule.createGetSelectedClassHandler, 'function');

      const noneHandler = arenaModule.createGetSelectedClassHandler({
        async query() {
          return { rows: [{ selected_class_id: null, class_id: null }] };
        },
      });
      const resNone = createMockRes();
      await noneHandler({ user: { player_id: 7 } }, resNone);
      assert.equal(resNone.statusCode, 200);
      assert.equal(resNone.body.selected_class_id, null);
      assert.equal(resNone.body.selected_class, null);

      const missingHandler = arenaModule.createGetSelectedClassHandler({
        async query() {
          return { rows: [] };
        },
      });
      const resMissing = createMockRes();
      await missingHandler({ user: { player_id: 999 } }, resMissing);
      assert.equal(resMissing.statusCode, 404);
    });

    it('retourne HTTP 500 sans fuite technique sur erreur PostgreSQL', async () => {
      assert.equal(typeof arenaModule.createGetSelectedClassHandler, 'function');

      const handler = arenaModule.createGetSelectedClassHandler({
        async query() {
          throw new Error('db internal password leak');
        },
      });
      const res = createMockRes();
      await handler({ user: { player_id: 7 } }, res);

      assert.equal(res.statusCode, 500);
      assert.ok(!res.body.error.includes('password leak'));
    });
  });

  describe('Montage HTTP & Garde JWT (/classes/select, /classes/selected et /api/classes/*)', () => {
    it('protège les routes par JWT et respecte l’ordre avant /:id', async () => {
      const originalQuery = pool.query.bind(pool);
      pool.query = async (sql, params) => {
        if (sql.includes('FROM class WHERE class_id = $1')) {
          return { rows: params[0] === 1 ? [SAMPLE_BASE_CLASS] : [] };
        }
        if (sql.includes('UPDATE "user"')) {
          return { rows: [{ player_id: params[1], selected_class_id: params[0] }] };
        }
        if (sql.includes('LEFT JOIN class')) {
          return { rows: [{ selected_class_id: 1, ...SAMPLE_BASE_CLASS }] };
        }
        return { rows: [SAMPLE_BASE_CLASS] };
      };

      const validToken = jwt.sign(
        { player_id: 7, username: 'CyberPilot' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });

      try {
        const { port } = server.address();
        const baseUrl = `http://127.0.0.1:${port}`;

        const noAuthSelect = await sendHttpRequest(baseUrl, 'POST', '/classes/select', {
          body: { class_id: 1 },
        });
        assert.equal(noAuthSelect.status, 401);

        const badAuthSelected = await sendHttpRequest(
          baseUrl,
          'GET',
          '/classes/selected',
          { token: 'invalid.jwt.token' }
        );
        assert.equal(badAuthSelected.status, 403);

        const postDirect = await sendHttpRequest(baseUrl, 'POST', '/classes/select', {
          token: validToken,
          body: { class_id: 1 },
        });
        assert.equal(postDirect.status, 200);
        assert.equal(postDirect.body.selected_class_id, 1);

        const putApi = await sendHttpRequest(baseUrl, 'PUT', '/api/classes/select', {
          token: validToken,
          body: { class_id: 1 },
        });
        assert.equal(putApi.status, 200);
        assert.equal(putApi.body.selected_class.name, 'Guerrier');

        const getSelectedDirect = await sendHttpRequest(
          baseUrl,
          'GET',
          '/classes/selected',
          { token: validToken }
        );
        assert.equal(getSelectedDirect.status, 200);
        assert.equal(getSelectedDirect.body.selected_class_id, 1);

        const getSelectedApi = await sendHttpRequest(
          baseUrl,
          'GET',
          '/api/classes/selected',
          { token: validToken }
        );
        assert.equal(getSelectedApi.status, 200);
        assert.equal(getSelectedApi.body.selected_class.name, 'Guerrier');

        const getByIdStillWorks = await sendHttpRequest(baseUrl, 'GET', '/classes/1');
        assert.equal(getByIdStillWorks.status, 200);
        assert.equal(getByIdStillWorks.body.class.name, 'Guerrier');
      } finally {
        pool.query = originalQuery;
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });
});
