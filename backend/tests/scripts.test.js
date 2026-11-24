import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import * as scriptsModule from '../routes/scripts.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

process.env.NODE_ENV = 'test';
const { app } = await import('../index.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const initSqlPath = path.resolve(__dirname, '../db/init.sql');
const initSql = fs.readFileSync(initSqlPath, 'utf8');

const SAMPLE_SCRIPT_ROW = {
  script_id: 10,
  match_id: null,
  player_id: 7,
  class_id: 1,
  code_content: 'def on_tick(game):\n    game.wait()\n',
  round_number: 1,
  updated_at: '2026-11-24T14:00:00.000Z',
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

    const req = http.request(
      url,
      { method, headers },
      (res) => {
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
      }
    );

    req.on('error', reject);
    if (payload !== null) {
      req.write(payload);
    }
    req.end();
  });
}

describe('Sprint 3 - Issues #22 & #23 : Sauvegarde et récupération des scripts', () => {
  describe('Schéma SQL de la table script (init.sql)', () => {
    it('autorise match_id et class_id NULL, définit round_number DEFAULT 1 et updated_at', () => {
      const createTableMatch = initSql.match(
        /CREATE TABLE IF NOT EXISTS script\s*\(([\s\S]*?)\);/
      );
      assert.ok(createTableMatch, 'Table script introuvable dans init.sql');

      const tableBody = createTableMatch[1];
      assert.ok(!tableBody.includes('match_id INT NOT NULL'));
      assert.ok(!tableBody.includes('class_id INT NOT NULL'));
      assert.ok(tableBody.includes('round_number INT NOT NULL DEFAULT 1'));
      assert.ok(
        tableBody.includes('updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP')
      );
      assert.ok(initSql.includes('ALTER TABLE script ALTER COLUMN match_id DROP NOT NULL'));
      assert.ok(initSql.includes('ALTER TABLE script ALTER COLUMN class_id DROP NOT NULL'));
      assert.ok(
        initSql.includes(
          'ALTER TABLE script ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'
        )
      );
    });
  });

  describe('formatScriptRow', () => {
    it('retourne les champs normalisés d’un script', () => {
      assert.equal(typeof scriptsModule.formatScriptRow, 'function');

      const formatted = scriptsModule.formatScriptRow(SAMPLE_SCRIPT_ROW);
      assert.deepEqual(formatted, {
        script_id: 10,
        player_id: 7,
        match_id: null,
        class_id: 1,
        code_content: 'def on_tick(game):\n    game.wait()\n',
        round_number: 1,
        updated_at: '2026-11-24T14:00:00.000Z',
      });
    });
  });

  describe('Issue #22 - createSaveScriptHandler (POST /scripts)', () => {
    it('rejette un code_content manquant, vide ou trop long avec HTTP 400 sans requêter la DB', async () => {
      assert.equal(typeof scriptsModule.createSaveScriptHandler, 'function');

      let queryCalled = false;
      const fakeDb = {
        async query() {
          queryCalled = true;
          return { rows: [] };
        },
      };

      const handler = scriptsModule.createSaveScriptHandler(fakeDb);
      const invalidBodies = [
        {},
        { code_content: 12345 },
        { code_content: '   \n\t  ' },
        { code_content: 'a'.repeat(50001) },
      ];

      for (const body of invalidBodies) {
        const res = createMockRes();
        await handler({ user: { player_id: 7 }, body }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(typeof res.body.error, 'string');
      }
      assert.equal(queryCalled, false);
    });

    it('rejette script_id, class_id, match_id ou round_number invalides avec HTTP 400', async () => {
      assert.equal(typeof scriptsModule.createSaveScriptHandler, 'function');

      let queryCalled = false;
      const fakeDb = {
        async query() {
          queryCalled = true;
          return { rows: [] };
        },
      };

      const handler = scriptsModule.createSaveScriptHandler(fakeDb);
      const invalidPayloads = [
        { code_content: 'pass', script_id: 'abc' },
        { code_content: 'pass', script_id: 0 },
        { code_content: 'pass', class_id: -2 },
        { code_content: 'pass', match_id: 'bad' },
        { code_content: 'pass', round_number: 0 },
      ];

      for (const body of invalidPayloads) {
        const res = createMockRes();
        await handler({ user: { player_id: 7 }, body }, res);
        assert.equal(res.statusCode, 400);
      }
      assert.equal(queryCalled, false);
    });

    it('crée un nouveau script brouillon (HTTP 201) si le joueur n’en a pas encore', async () => {
      assert.equal(typeof scriptsModule.createSaveScriptHandler, 'function');

      const calls = [];
      const fakeDb = {
        async query(sql, params) {
          calls.push({ sql, params });
          if (calls.length === 1) {
            return { rows: [] };
          }
          return { rows: [{ ...SAMPLE_SCRIPT_ROW, script_id: 11 }] };
        },
      };

      const handler = scriptsModule.createSaveScriptHandler(fakeDb);
      const res = createMockRes();
      await handler(
        {
          user: { player_id: 7 },
          body: { code_content: 'def on_tick(game):\n    game.wait()\n' },
        },
        res
      );

      assert.equal(res.statusCode, 201);
      assert.equal(calls.length, 2);
      assert.ok(calls[0].sql.includes('match_id IS NULL'));
      assert.deepEqual(calls[0].params, [7]);
      assert.ok(calls[1].sql.includes('INSERT INTO script'));
      assert.equal(res.body.script.script_id, 11);
      assert.equal(typeof res.body.message, 'string');
    });

    it('met à jour le brouillon existant (HTTP 200) si le joueur en possède déjà un', async () => {
      assert.equal(typeof scriptsModule.createSaveScriptHandler, 'function');

      const calls = [];
      const fakeDb = {
        async query(sql, params) {
          calls.push({ sql, params });
          if (calls.length === 1) {
            return { rows: [{ script_id: 10 }] };
          }
          return {
            rows: [
              {
                ...SAMPLE_SCRIPT_ROW,
                code_content: 'def on_tick(game):\n    game.attack(None)\n',
              },
            ],
          };
        },
      };

      const handler = scriptsModule.createSaveScriptHandler(fakeDb);
      const res = createMockRes();
      await handler(
        {
          user: { player_id: 7 },
          body: {
            code_content: 'def on_tick(game):\n    game.attack(None)\n',
            class_id: 2,
          },
        },
        res
      );

      assert.equal(res.statusCode, 200);
      assert.equal(calls.length, 2);
      assert.ok(calls[1].sql.includes('UPDATE script'));
      assert.ok(calls[1].sql.includes('WHERE script_id = $3 AND player_id = $4'));
      assert.equal(res.body.script.script_id, 10);
    });

    it('met à jour un script ciblé par script_id (HTTP 200) ou renvoie 404 si absent/autre joueur', async () => {
      assert.equal(typeof scriptsModule.createSaveScriptHandler, 'function');

      const fakeDbFound = {
        async query(sql, params) {
          assert.ok(sql.includes('UPDATE script'));
          assert.deepEqual(params, ['new code', null, 10, 7]);
          return { rows: [{ ...SAMPLE_SCRIPT_ROW, code_content: 'new code' }] };
        },
      };

      const handlerFound = scriptsModule.createSaveScriptHandler(fakeDbFound);
      const resFound = createMockRes();
      await handlerFound(
        { user: { player_id: 7 }, body: { script_id: 10, code_content: 'new code' } },
        resFound
      );
      assert.equal(resFound.statusCode, 200);
      assert.equal(resFound.body.script.code_content, 'new code');

      const fakeDbMissing = {
        async query() {
          return { rows: [] };
        },
      };

      const handlerMissing = scriptsModule.createSaveScriptHandler(fakeDbMissing);
      const resMissing = createMockRes();
      await handlerMissing(
        { user: { player_id: 7 }, body: { script_id: 999, code_content: 'new code' } },
        resMissing
      );
      assert.equal(resMissing.statusCode, 404);
    });

    it('renvoie HTTP 500 sans fuite technique en cas d’erreur PostgreSQL', async () => {
      assert.equal(typeof scriptsModule.createSaveScriptHandler, 'function');

      const fakeDb = {
        async query() {
          throw new Error('pg internal stack password');
        },
      };

      const handler = scriptsModule.createSaveScriptHandler(fakeDb);
      const res = createMockRes();
      await handler(
        { user: { player_id: 7 }, body: { code_content: 'def on_tick(g): pass' } },
        res
      );

      assert.equal(res.statusCode, 500);
      assert.ok(!res.body.error.includes('pg internal'));
    });
  });

  describe('Issue #23 - createGetLatestScriptHandler & createGetScriptByIdHandler', () => {
    it('renvoie le dernier script sauvegardé du joueur connecté (HTTP 200) ou 404 si absent', async () => {
      assert.equal(typeof scriptsModule.createGetLatestScriptHandler, 'function');

      const calls = [];
      const fakeDb = {
        async query(sql, params) {
          calls.push({ sql, params });
          return { rows: [SAMPLE_SCRIPT_ROW] };
        },
      };

      const handler = scriptsModule.createGetLatestScriptHandler(fakeDb);
      const res = createMockRes();
      await handler({ user: { player_id: 7 } }, res);

      assert.equal(res.statusCode, 200);
      assert.ok(calls[0].sql.includes('ORDER BY updated_at DESC, script_id DESC'));
      assert.deepEqual(calls[0].params, [7]);
      assert.equal(res.body.script.script_id, 10);

      const emptyHandler = scriptsModule.createGetLatestScriptHandler({
        async query() {
          return { rows: [] };
        },
      });
      const resEmpty = createMockRes();
      await emptyHandler({ user: { player_id: 7 } }, resEmpty);
      assert.equal(resEmpty.statusCode, 404);
    });

    it('renvoie le script ciblé par id (HTTP 200) pour le propriétaire uniquement', async () => {
      assert.equal(typeof scriptsModule.createGetScriptByIdHandler, 'function');

      const calls = [];
      const fakeDb = {
        async query(sql, params) {
          calls.push({ sql, params });
          return { rows: [SAMPLE_SCRIPT_ROW] };
        },
      };

      const handler = scriptsModule.createGetScriptByIdHandler(fakeDb);
      const res = createMockRes();
      await handler({ user: { player_id: 7 }, params: { id: '10' } }, res);

      assert.equal(res.statusCode, 200);
      assert.ok(calls[0].sql.includes('WHERE script_id = $1 AND player_id = $2'));
      assert.deepEqual(calls[0].params, [10, 7]);
      assert.equal(res.body.script.script_id, 10);
    });

    it('supporte GET /scripts/latest et GET /scripts/:player_id en fallback pour le joueur connecté', async () => {
      assert.equal(typeof scriptsModule.createGetScriptByIdHandler, 'function');

      const latestHandler = scriptsModule.createGetScriptByIdHandler({
        async query(sql, params) {
          assert.ok(sql.includes('ORDER BY updated_at DESC, script_id DESC'));
          assert.deepEqual(params, [7]);
          return { rows: [SAMPLE_SCRIPT_ROW] };
        },
      });
      const resLatest = createMockRes();
      await latestHandler({ user: { player_id: 7 }, params: { id: 'latest' } }, resLatest);
      assert.equal(resLatest.statusCode, 200);
      assert.equal(resLatest.body.script.script_id, 10);

      let step = 0;
      const fallbackHandler = scriptsModule.createGetScriptByIdHandler({
        async query(sql, params) {
          step += 1;
          if (step === 1) {
            assert.deepEqual(params, [7, 7]);
            return { rows: [] };
          }
          assert.ok(sql.includes('ORDER BY updated_at DESC, script_id DESC'));
          assert.deepEqual(params, [7]);
          return { rows: [SAMPLE_SCRIPT_ROW] };
        },
      });
      const resFallback = createMockRes();
      await fallbackHandler({ user: { player_id: 7 }, params: { id: '7' } }, resFallback);
      assert.equal(resFallback.statusCode, 200);
      assert.equal(resFallback.body.script.script_id, 10);
    });

    it('renvoie 400 si id invalide, 404 si introuvable et 500 sur erreur DB', async () => {
      assert.equal(typeof scriptsModule.createGetScriptByIdHandler, 'function');

      let queryCalled = false;
      const badHandler = scriptsModule.createGetScriptByIdHandler({
        async query() {
          queryCalled = true;
          return { rows: [] };
        },
      });
      for (const badId of ['abc', '0', '-3']) {
        const res = createMockRes();
        await badHandler({ user: { player_id: 7 }, params: { id: badId } }, res);
        assert.equal(res.statusCode, 400);
      }
      assert.equal(queryCalled, false);

      const notFoundHandler = scriptsModule.createGetScriptByIdHandler({
        async query() {
          return { rows: [] };
        },
      });
      const res404 = createMockRes();
      await notFoundHandler({ user: { player_id: 7 }, params: { id: '999' } }, res404);
      assert.equal(res404.statusCode, 404);

      const errHandler = scriptsModule.createGetScriptByIdHandler({
        async query() {
          throw new Error('secret db failure');
        },
      });
      const res500 = createMockRes();
      await errHandler({ user: { player_id: 7 }, params: { id: '10' } }, res500);
      assert.equal(res500.statusCode, 500);
      assert.ok(!res500.body.error.includes('secret db'));
    });
  });

  describe('Montage HTTP & Garde JWT (/scripts et /api/scripts)', () => {
    it('protège les routes par JWT (401/403) et expose POST/GET sur /scripts et /api/scripts', async () => {
      const originalQuery = pool.query.bind(pool);
      pool.query = async (sql, params) => {
        if (sql.includes('AND match_id IS NULL')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO script')) {
          return {
            rows: [
              {
                ...SAMPLE_SCRIPT_ROW,
                player_id: params[1],
                code_content: params[3],
              },
            ],
          };
        }
        if (sql.includes('WHERE script_id = $1 AND player_id = $2')) {
          return { rows: [SAMPLE_SCRIPT_ROW] };
        }
        if (sql.includes('ORDER BY updated_at DESC, script_id DESC')) {
          return { rows: [SAMPLE_SCRIPT_ROW] };
        }
        return { rows: [] };
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

        const noAuthPost = await sendHttpRequest(baseUrl, 'POST', '/api/scripts', {
          body: { code_content: 'pass' },
        });
        assert.equal(noAuthPost.status, 401);

        const badAuthGet = await sendHttpRequest(baseUrl, 'GET', '/scripts/10', {
          token: 'invalid.jwt.token',
        });
        assert.equal(badAuthGet.status, 403);

        const postApi = await sendHttpRequest(baseUrl, 'POST', '/api/scripts', {
          token: validToken,
          body: { code_content: 'def on_tick(g): g.wait()' },
        });
        assert.equal(postApi.status, 201);
        assert.equal(postApi.body.script.player_id, 7);

        const postDirect = await sendHttpRequest(baseUrl, 'POST', '/scripts', {
          token: validToken,
          body: { code_content: 'def on_tick(g): g.wait()' },
        });
        assert.equal(postDirect.status, 201);

        const getById = await sendHttpRequest(baseUrl, 'GET', '/scripts/10', {
          token: validToken,
        });
        assert.equal(getById.status, 200);
        assert.equal(getById.body.script.script_id, 10);

        const getLatestApi = await sendHttpRequest(
          baseUrl,
          'GET',
          '/api/scripts/latest',
          { token: validToken }
        );
        assert.equal(getLatestApi.status, 200);
        assert.equal(getLatestApi.body.script.script_id, 10);

        const getRootApi = await sendHttpRequest(baseUrl, 'GET', '/api/scripts', {
          token: validToken,
        });
        assert.equal(getRootApi.status, 200);
        assert.equal(getRootApi.body.script.script_id, 10);
      } finally {
        pool.query = originalQuery;
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });
});
