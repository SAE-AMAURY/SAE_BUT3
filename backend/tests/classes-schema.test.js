import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const initSqlPath = path.resolve(__dirname, '../db/init.sql');
const initSql = fs.readFileSync(initSqlPath, 'utf8');

function extractClassSeeds(sqlContent) {
  const tupleRegex =
    /\(\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*'(\[[\s\S]*?\])'::jsonb,\s*(NULL|\d+)\s*\)/g;
  const classes = new Map();

  for (const match of sqlContent.matchAll(tupleRegex)) {
    const [
      ,
      name,
      description,
      health,
      range,
      damage,
      actionPoints,
      functionsJson,
      requiredMissionId,
    ] = match;

    classes.set(name, {
      name,
      description,
      base_health: Number(health),
      base_range: Number(range),
      base_damage: Number(damage),
      base_action_points: Number(actionPoints),
      available_functions: JSON.parse(functionsJson),
      required_mission_id:
        requiredMissionId === 'NULL' ? null : Number(requiredMissionId),
    });
  }

  return classes;
}

describe('Sprint 4 - Issue #27 : Schéma SQL de la table class', () => {
  it('définit les colonnes et contraintes requises sur class', () => {
    const createTableMatch = initSql.match(
      /CREATE TABLE IF NOT EXISTS class\s*\(([\s\S]*?)\);/
    );
    assert.ok(createTableMatch, 'Table class introuvable dans init.sql');

    const tableBody = createTableMatch[1];
    const requiredTokens = [
      'class_id SERIAL PRIMARY KEY',
      'name VARCHAR(50) NOT NULL',
      'description TEXT NOT NULL',
      'base_health INT NOT NULL',
      'base_range INT NOT NULL',
      'base_damage INT NOT NULL',
      'base_action_points INT NOT NULL',
      'available_functions JSONB NOT NULL',
      'required_mission_id INT',
      'CONSTRAINT uq_class_name UNIQUE (name)',
      'CONSTRAINT chk_class_stats_positive CHECK',
    ];

    for (const token of requiredTokens) {
      assert.ok(
        tableBody.includes(token),
        `Définition manquante dans class : ${token}`
      );
    }
  });

  it('prévoit une migration idempotente et un seed sans doublon', () => {
    assert.ok(
      initSql.includes('ALTER TABLE class ADD COLUMN IF NOT EXISTS description'),
      'Migration colonne description manquante'
    );
    assert.ok(
      initSql.includes(
        'ALTER TABLE class ADD COLUMN IF NOT EXISTS base_action_points'
      ),
      'Migration colonne base_action_points manquante'
    );
    assert.ok(
      initSql.includes(
        'ALTER TABLE class ADD COLUMN IF NOT EXISTS available_functions'
      ),
      'Migration colonne available_functions manquante'
    );
    assert.ok(
      initSql.includes('ON CONFLICT (name) DO UPDATE'),
      'Upsert ON CONFLICT (name) DO UPDATE manquant pour les classes'
    );
  });

  it('contient les trois classes initiales avec des stats cohérentes', () => {
    const classes = extractClassSeeds(initSql);

    assert.equal(classes.size, 3);
    assert.deepEqual([...classes.keys()], ['Guerrier', 'Tank', 'Sniper']);

    for (const cls of classes.values()) {
      assert.ok(cls.description.length > 0);
      assert.ok(Number.isInteger(cls.base_health) && cls.base_health > 0);
      assert.ok(Number.isInteger(cls.base_range) && cls.base_range > 0);
      assert.ok(Number.isInteger(cls.base_damage) && cls.base_damage > 0);
      assert.ok(
        Number.isInteger(cls.base_action_points) && cls.base_action_points > 0
      );
    }

    const guerrier = classes.get('Guerrier');
    const tank = classes.get('Tank');
    const sniper = classes.get('Sniper');

    assert.equal(guerrier.base_health, 100);
    assert.equal(guerrier.base_range, 1);
    assert.equal(guerrier.base_damage, 25);
    assert.equal(guerrier.base_action_points, 3);

    assert.equal(tank.base_health, 160);
    assert.equal(tank.base_range, 1);
    assert.equal(tank.base_damage, 15);
    assert.equal(tank.base_action_points, 2);

    assert.equal(sniper.base_health, 70);
    assert.equal(sniper.base_range, 4);
    assert.equal(sniper.base_damage, 35);
    assert.equal(sniper.base_action_points, 3);

    assert.ok(tank.base_health > guerrier.base_health);
    assert.ok(guerrier.base_health > sniper.base_health);
    assert.ok(sniper.base_range > guerrier.base_range);
    assert.ok(sniper.base_damage > guerrier.base_damage);
    assert.ok(guerrier.base_damage > tank.base_damage);
  });

  it('définit des fonctions JSONB valides et distinctives par classe', () => {
    const classes = extractClassSeeds(initSql);
    const baseFunctions = ['move', 'attack', 'scan', 'wait'];
    const expectedSpecials = {
      Guerrier: 'charge',
      Tank: 'shield',
      Sniper: 'snipe',
    };

    for (const [name, cls] of classes.entries()) {
      assert.ok(Array.isArray(cls.available_functions));
      assert.ok(cls.available_functions.length >= 5);

      for (const fn of cls.available_functions) {
        assert.equal(typeof fn.name, 'string');
        assert.ok(fn.name.length > 0);
        assert.equal(typeof fn.signature, 'string');
        assert.ok(fn.signature.length > 0);
        assert.ok(Number.isInteger(fn.ap_cost) && fn.ap_cost >= 0);
        assert.equal(typeof fn.description, 'string');
        assert.ok(fn.description.length > 0);
      }

      const fnNames = cls.available_functions.map((fn) => fn.name);
      for (const baseFn of baseFunctions) {
        assert.ok(
          fnNames.includes(baseFn),
          `Fonction de base ${baseFn} manquante pour ${name}`
        );
      }

      const specialFn = expectedSpecials[name];
      assert.ok(
        fnNames.includes(specialFn),
        `Fonction spécifique ${specialFn} manquante pour ${name}`
      );
    }
  });
});
