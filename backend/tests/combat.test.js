import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../services/engine/Grid.js';
import {
  CombatLoop,
  DEFAULT_CLASSES,
  ACTION_COSTS,
} from '../services/engine/CombatLoop.js';

describe('Issue #30 - Moteur : Boucle de combat tour par tour, PA et dégâts', () => {
  function setupMatch(class1 = 'Guerrier', class2 = 'Tank') {
    const grid = new Grid({ width: 10, height: 6 });
    const bot1 = {
      id: 'bot-1',
      name: 'Alpha',
      class: class1,
    };
    const bot2 = {
      id: 'bot-2',
      name: 'Omega',
      class: class2,
    };
    const combat = new CombatLoop({
      grid,
      bot1,
      bot2,
      maxRounds: 30,
      maxAp: 3,
    });
    combat.initCombat();
    return { grid, bot1, bot2, combat };
  }

  describe('Initialisation des combattants et des caractéristiques de classes', () => {
    it('doit configurer les PV, portées et dégâts selon la classe (Guerrier, Tank, Sniper)', () => {
      const { bot1, bot2 } = setupMatch('Sniper', 'Guerrier');

      // Sniper
      assert.equal(bot1.hp, 70);
      assert.equal(bot1.maxHp, 70);
      assert.equal(bot1.range, 4);
      assert.equal(bot1.damage, 35);
      assert.equal(bot1.ap, 3);
      assert.equal(bot1.isAlive, true);

      // Guerrier
      assert.equal(bot2.hp, 100);
      assert.equal(bot2.maxHp, 100);
      assert.equal(bot2.range, 1);
      assert.equal(bot2.damage, 25);
      assert.equal(bot2.ap, 3);
      assert.equal(bot2.isAlive, true);
    });

    it('doit positionner les bots sur la grille lors de initCombat', () => {
      const { grid, bot1, bot2, combat } = setupMatch();
      assert.equal(combat.status, 'IN_PROGRESS');
      assert.deepEqual(bot1.position, { x: 1, y: 3 });
      assert.deepEqual(bot2.position, { x: 8, y: 3 });
      assert.equal(combat.getActiveBot().id, 'bot-1');
    });
  });

  describe('Gestion des Points d Action (PA)', () => {
    it('doit déduire 1 PA lors d un déplacement valide', () => {
      const { bot1, combat } = setupMatch();
      assert.equal(bot1.ap, 3);

      const result = combat.executeAction('bot-1', {
        type: 'MOVE',
        target: { x: 2, y: 3 },
      });

      assert.equal(result.success, true);
      assert.equal(bot1.ap, 2);
      assert.deepEqual(bot1.position, { x: 2, y: 3 });
    });

    it('doit déduire 2 PA lors d une attaque', () => {
      const { grid, bot1, bot2, combat } = setupMatch('Guerrier', 'Guerrier');
      // Placer bot2 adjacent à bot1 pour permettre l'attaque du Guerrier (range = 1)
      grid.moveBot('bot-2', { x: 7, y: 3 });
      grid.placeBot(bot2, { x: 2, y: 3 }); // directement à côté de { x: 1, y: 3 }

      const result = combat.executeAction('bot-1', {
        type: 'ATTACK',
        targetId: 'bot-2',
      });

      assert.equal(result.success, true);
      assert.equal(bot1.ap, 1); // 3 - 2 = 1
      assert.equal(bot2.hp, 75); // 100 - 25 = 75
    });

    it('doit refuser une action si le bot n a pas assez de PA', () => {
      const { grid, bot1, bot2, combat } = setupMatch('Guerrier', 'Guerrier');
      grid.placeBot(bot2, { x: 2, y: 3 });
      bot1.ap = 1; // seulement 1 PA disponible, or ATTACK coûte 2 PA

      const result = combat.executeAction('bot-1', {
        type: 'ATTACK',
        targetId: 'bot-2',
      });

      assert.equal(result.success, false);
      assert.equal(result.reason, 'INSUFFICIENT_AP');
      assert.equal(bot1.ap, 1);
      assert.equal(bot2.hp, 100);
    });

    it('doit réinitialiser les PA à chaque nouveau tour du bot', () => {
      const { bot1, bot2, combat } = setupMatch();
      // bot1 passe son tour
      combat.executeAction('bot-1', { type: 'PASS' });
      assert.equal(combat.getActiveBot().id, 'bot-2');

      // bot2 passe son tour
      combat.executeAction('bot-2', { type: 'PASS' });

      // Nouveau round : bot1 rejoue avec PA réinitialisés à 3
      assert.equal(combat.roundNumber, 2);
      assert.equal(combat.getActiveBot().id, 'bot-1');
      assert.equal(bot1.ap, 3);
      assert.equal(bot2.ap, 3);
    });
  });

  describe('Calcul des dégâts et portée', () => {
    it('doit permettre au Sniper d attaquer à distance (portée 4)', () => {
      const { bot1, bot2, combat } = setupMatch('Sniper', 'Tank');
      // Distance initiale : |8-1| + |3-3| = 7 (hors de portée 4)
      let outOfRange = combat.executeAction('bot-1', {
        type: 'ATTACK',
        targetId: 'bot-2',
      });
      assert.equal(outOfRange.success, false);
      assert.equal(outOfRange.reason, 'OUT_OF_RANGE');

      // Déplacer bot1 vers x=4 (distance avec x=8 devient 4)
      bot1.position = { x: 4, y: 3 };
      combat.grid.placeBot(bot1, { x: 4, y: 3 });

      let inRange = combat.executeAction('bot-1', {
        type: 'ATTACK',
        targetId: 'bot-2',
      });
      assert.equal(inRange.success, true);
      assert.equal(bot2.hp, 160 - 35); // Tank 160 - Sniper 35 = 125
    });

    it('doit refuser l action si ce n est pas le tour du bot', () => {
      const { combat } = setupMatch();
      assert.equal(combat.getActiveBot().id, 'bot-1');

      const result = combat.executeAction('bot-2', {
        type: 'MOVE',
        target: { x: 7, y: 3 },
      });

      assert.equal(result.success, false);
      assert.equal(result.reason, 'NOT_YOUR_TURN');
    });
  });

  describe('Conditions de fin de combat et victoire', () => {
    it('doit déclarer la victoire par élimination (KO)', () => {
      const { grid, bot1, bot2, combat } = setupMatch('Sniper', 'Tank');
      grid.placeBot(bot2, { x: 2, y: 3 });
      bot2.hp = 30; // PV inférieurs aux dégâts du Sniper (35)

      const result = combat.executeAction('bot-1', {
        type: 'ATTACK',
        targetId: 'bot-2',
      });

      assert.equal(result.success, true);
      assert.equal(bot2.hp, 0);
      assert.equal(bot2.isAlive, false);
      assert.equal(combat.isGameOver(), true);
      assert.equal(combat.status, 'FINISHED');
      assert.equal(combat.winner.id, 'bot-1');
      assert.equal(combat.finishReason, 'ELIMINATION');
    });

    it('doit terminer la partie sur limite de rounds atteinte (MAX_ROUNDS_REACHED)', () => {
      const grid = new Grid({ width: 10, height: 6 });
      const bot1 = { id: 'b1', name: 'A', class: 'Guerrier' };
      const bot2 = { id: 'b2', name: 'B', class: 'Guerrier' };
      const combat = new CombatLoop({
        grid,
        bot1,
        bot2,
        maxRounds: 2,
        maxAp: 3,
      });
      combat.initCombat();

      // Round 1
      combat.executeAction('b1', { type: 'PASS' });
      combat.executeAction('b2', { type: 'PASS' });

      // Round 2
      combat.executeAction('b1', { type: 'PASS' });
      combat.executeAction('b2', { type: 'PASS' });

      assert.equal(combat.isGameOver(), true);
      assert.equal(combat.status, 'FINISHED');
      assert.equal(combat.finishReason, 'MAX_ROUNDS_REACHED');
    });
  });
});
