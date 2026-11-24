import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as arenaModule from '../routes/arena.js';
import { pool } from '../db/pool.js';

process.env.NODE_ENV = 'test';
const { app } = await import('../index.js');

const SAMPLE_FUNCTIONS = [
  {
    name: 'move',
    signature: 'move(direction)',
    ap_cost: 1,
    description: 'Déplace le bot sur une case adjacente.',
  },
  {
    name: 'attack',
    signature: 'attack(target)',
    ap_cost: 2,
    description: 'Attaque une cible ennemie à portée.',
  },
];

const SAMPLE_ROWS = [
  {
    class_id: 1,
    name: 'Guerrier',
    description: 'Combattant polyvalent.',
    base_health: 100,
    base_range: 1,
    base_damage: 25,
    base_action_points: 3,
    available_functions: SAMPLE_FUNCTIONS,
    required_mission_id: null,
  },
  {
    class_id: 2,
    name: 'Tank',
    description: 'Unité blindée.',
    base_health: 160,
    base_range: 1,
    base_damage: 15,
    base_action_points: 2,
    available_functions: JSON.stringify(SAMPLE_FUNCTIONS),
    required_mission_id: 1,
  },
];

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

function requestJson(baseUrl, pathname) {
  return new Promise((resolve, reject) => {
    http
      .get(`${baseUrl}${pathname}`, (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              body: JSON.parse(raw),
            });
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

describe('Sprint 4 - Issue #28 : Route des classes (GET /classes & GET /api/classes)', () => {
  describe('formatClassRow', () => {
    it('formate les stats, capacités JSONB et champs de rétrocompatibilité', () => {
      assert.equal(typeof arenaModule.formatClassRow, 'function');

      const formatted = arenaModule.formatClassRow(SAMPLE_ROWS[0]);
      assert.deepEqual(formatted, {
        class_id: 1,
        name: 'Guerrier',
        description: 'Combattant polyvalent.',
        base_health: 100,
        base_range: 1,
        base_damage: 25,
        base_action_points: 3,
        stats: {
          health: 100,
          range: 1,
          damage: 25,
          action_points: 3,
        },
        available_functions: SAMPLE_FUNCTIONS,
        required_mission_id: null,
      });

      const fromString = arenaModule.formatClassRow(SAMPLE_ROWS[1]);
      assert.deepEqual(fromString.available_functions, SAMPLE_FUNCTIONS);
      assert.equal(fromString.required_mission_id, 1);

      const withNullFunctions = arenaModule.formatClassRow({
        ...SAMPLE_ROWS[0],
        description: null,
        available_functions: null,
      });
      assert.equal(withNullFunctions.description, '');
      assert.deepEqual(withNullFunctions.available_functions, []);
    });
  });

  describe('createGetClassesHandler', () => {
    it('retourne HTTP 200 avec les classes triées et des colonnes explicites', async () => {
      assert.equal(typeof arenaModule.createGetClassesHandler, 'function');

      const calls = [];
      const fakeDb = {
        async query(sql, params) {
          calls.push({ sql, params });
          return { rows: SAMPLE_ROWS };
        },
      };

      const handler = arenaModule.createGetClassesHandler(fakeDb);
      const res = createMockRes();
      await handler({}, res);

      assert.equal(res.statusCode, 200);
      assert.equal(calls.length, 1);
      assert.ok(!calls[0].sql.includes('SELECT *'));
      assert.ok(calls[0].sql.includes('ORDER BY class_id ASC'));
      assert.equal(res.body.classes.length, 2);
      assert.equal(res.body.classes[0].stats.health, 100);
      assert.equal(res.body.classes[1].stats.action_points, 2);
    });

    it('retourne HTTP 500 sans fuite technique en cas de panne PostgreSQL', async () => {
      assert.equal(typeof arenaModule.createGetClassesHandler, 'function');

      const fakeDb = {
        async query() {
          throw new Error('ECONNREFUSED secret internal detail');
        },
      };

      const handler = arenaModule.createGetClassesHandler(fakeDb);
      const res = createMockRes();
      await handler({}, res);

      assert.equal(res.statusCode, 500);
      assert.equal(typeof res.body.error, 'string');
      assert.ok(!res.body.error.includes('ECONNREFUSED'));
    });
  });

  describe('createGetClassByIdHandler', () => {
    it('retourne HTTP 200 avec une requête paramétrée pour un id valide', async () => {
      assert.equal(typeof arenaModule.createGetClassByIdHandler, 'function');

      const calls = [];
      const fakeDb = {
        async query(sql, params) {
          calls.push({ sql, params });
          return { rows: [SAMPLE_ROWS[0]] };
        },
      };

      const handler = arenaModule.createGetClassByIdHandler(fakeDb);
      const res = createMockRes();
      await handler({ params: { id: '1' } }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(calls.length, 1);
      assert.ok(calls[0].sql.includes('$1'));
      assert.deepEqual(calls[0].params, [1]);
      assert.equal(res.body.class.class_id, 1);
      assert.equal(res.body.class.stats.damage, 25);
    });

    it('retourne HTTP 400 pour un id invalide sans interroger la base', async () => {
      assert.equal(typeof arenaModule.createGetClassByIdHandler, 'function');

      let queryCalled = false;
      const fakeDb = {
        async query() {
          queryCalled = true;
          return { rows: [] };
        },
      };

      const handler = arenaModule.createGetClassByIdHandler(fakeDb);
      for (const badId of ['abc', '0', '-1', '1.5']) {
        const res = createMockRes();
        await handler({ params: { id: badId } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(typeof res.body.error, 'string');
      }
      assert.equal(queryCalled, false);
    });

    it('retourne HTTP 404 si la classe est introuvable', async () => {
      assert.equal(typeof arenaModule.createGetClassByIdHandler, 'function');

      const fakeDb = {
        async query() {
          return { rows: [] };
        },
      };

      const handler = arenaModule.createGetClassByIdHandler(fakeDb);
      const res = createMockRes();
      await handler({ params: { id: '999' } }, res);

      assert.equal(res.statusCode, 404);
      assert.equal(typeof res.body.error, 'string');
    });

    it('retourne HTTP 500 en cas d’erreur PostgreSQL', async () => {
      assert.equal(typeof arenaModule.createGetClassByIdHandler, 'function');

      const fakeDb = {
        async query() {
          throw new Error('DB timeout secret');
        },
      };

      const handler = arenaModule.createGetClassByIdHandler(fakeDb);
      const res = createMockRes();
      await handler({ params: { id: '1' } }, res);

      assert.equal(res.statusCode, 500);
      assert.ok(!res.body.error.includes('DB timeout'));
    });
  });

  describe('Montage HTTP sur Express (/classes et /api/classes)', () => {
    it('expose GET /classes, GET /api/classes, GET /classes/:id et GET /api/classes/:id', async () => {
      const originalQuery = pool.query.bind(pool);
      pool.query = async (sql, params) => {
        if (sql.includes('WHERE class_id = $1')) {
          const found = SAMPLE_ROWS.find((row) => row.class_id === params[0]);
          return { rows: found ? [found] : [] };
        }
        return { rows: SAMPLE_ROWS };
      };

      const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });

      try {
        const { port } = server.address();
        const baseUrl = `http://127.0.0.1:${port}`;

        const listDirect = await requestJson(baseUrl, '/classes');
        assert.equal(listDirect.status, 200);
        assert.equal(listDirect.body.classes.length, 2);
        assert.equal(listDirect.body.classes[0].stats.health, 100);

        const listApi = await requestJson(baseUrl, '/api/classes');
        assert.equal(listApi.status, 200);
        assert.equal(listApi.body.classes.length, 2);

        const oneDirect = await requestJson(baseUrl, '/classes/1');
        assert.equal(oneDirect.status, 200);
        assert.equal(oneDirect.body.class.name, 'Guerrier');

        const oneApi = await requestJson(baseUrl, '/api/classes/2');
        assert.equal(oneApi.status, 200);
        assert.equal(oneApi.body.class.name, 'Tank');

        const badReq = await requestJson(baseUrl, '/classes/invalid');
        assert.equal(badReq.status, 400);

        const notFound = await requestJson(baseUrl, '/api/classes/999');
        assert.equal(notFound.status, 404);
      } finally {
        pool.query = originalQuery;
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });
});
