import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../services/engine/Grid.js';

describe('Issue #29 - Moteur : Modélisation grille 2D & positionnement initial', () => {
  describe('Initialisation et dimensions de la grille', () => {
    it('doit initialiser une grille avec dimensions par défaut (10x10)', () => {
      const grid = new Grid();
      assert.equal(grid.width, 10);
      assert.equal(grid.height, 10);
      assert.deepEqual(grid.obstacles, []);
    });

    it('doit accepter des dimensions personnalisées et des obstacles', () => {
      const obstacles = [
        { x: 3, y: 3 },
        { x: 4, y: 3 },
      ];
      const grid = new Grid({ width: 12, height: 8, obstacles });
      assert.equal(grid.width, 12);
      assert.equal(grid.height, 8);
      assert.equal(grid.obstacles.length, 2);
    });

    it('doit rejeter des dimensions invalides (négatives ou nulles)', () => {
      assert.throws(
        () => new Grid({ width: 0, height: 10 }),
        /Dimensions de grille invalides/
      );
      assert.throws(
        () => new Grid({ width: 10, height: -2 }),
        /Dimensions de grille invalides/
      );
    });
  });

  describe('Validation des coordonnées et obstacles (X/Y)', () => {
    const obstacles = [{ x: 2, y: 2 }];
    const grid = new Grid({ width: 5, height: 5, obstacles });

    it('doit vérifier correctement les limites de la grille (isWithinBounds)', () => {
      assert.equal(grid.isWithinBounds(0, 0), true);
      assert.equal(grid.isWithinBounds(4, 4), true);
      assert.equal(grid.isWithinBounds(-1, 0), false);
      assert.equal(grid.isWithinBounds(0, 5), false);
      assert.equal(grid.isWithinBounds(5, 2), false);
    });

    it('doit détecter la présence d obstacles (isObstacle)', () => {
      assert.equal(grid.isObstacle(2, 2), true);
      assert.equal(grid.isObstacle(0, 0), false);
    });

    it('doit calculer la distance de Manhattan entre deux positions', () => {
      assert.equal(grid.getDistance({ x: 1, y: 1 }, { x: 4, y: 5 }), 7); // |4-1| + |5-1| = 3 + 4 = 7
      assert.equal(grid.getDistance({ x: 2, y: 2 }, { x: 2, y: 2 }), 0);
    });
  });

  describe('Placement initial et déplacement des bots', () => {
    it('doit placer un bot sur une case libre et mettre à jour ses coordonnées', () => {
      const grid = new Grid({ width: 8, height: 8 });
      const bot = { id: 1, name: 'AlphaBot' };
      const success = grid.placeBot(bot, { x: 1, y: 1 });

      assert.equal(success, true);
      assert.deepEqual(bot.position, { x: 1, y: 1 });
      assert.equal(grid.getBotAt(1, 1)?.id, 1);
      assert.equal(grid.isCellFree(1, 1), false);
    });

    it('doit refuser le placement hors grille ou sur un obstacle', () => {
      const grid = new Grid({
        width: 5,
        height: 5,
        obstacles: [{ x: 2, y: 2 }],
      });
      const bot = { id: 1, name: 'AlphaBot' };

      assert.equal(grid.placeBot(bot, { x: -1, y: 0 }), false);
      assert.equal(grid.placeBot(bot, { x: 2, y: 2 }), false);
      assert.equal(grid.placeBot(bot, { x: 5, y: 5 }), false);
    });

    it('doit refuser le placement sur une case déjà occupée par un autre bot', () => {
      const grid = new Grid({ width: 6, height: 6 });
      const bot1 = { id: 1, name: 'Bot1' };
      const bot2 = { id: 2, name: 'Bot2' };

      grid.placeBot(bot1, { x: 2, y: 2 });
      const placed = grid.placeBot(bot2, { x: 2, y: 2 });

      assert.equal(placed, false);
      assert.equal(grid.getBotAt(2, 2)?.id, 1);
    });

    it('doit positionner automatiquement 2 combattants aux extrémités opposées (setInitialPositions)', () => {
      const grid = new Grid({ width: 10, height: 6 });
      const botA = { id: 'bot-a', name: 'Guerrier' };
      const botB = { id: 'bot-b', name: 'Tank' };

      const spawns = grid.setInitialPositions(botA, botB);

      assert.deepEqual(botA.position, { x: 1, y: 3 });
      assert.deepEqual(botB.position, { x: 8, y: 3 });
      assert.equal(botA.direction, 'EAST');
      assert.equal(botB.direction, 'WEST');
      assert.equal(grid.getBotAt(1, 3)?.id, 'bot-a');
      assert.equal(grid.getBotAt(8, 3)?.id, 'bot-b');
      assert.deepEqual(spawns, {
        bot1: { x: 1, y: 3, direction: 'EAST' },
        bot2: { x: 8, y: 3, direction: 'WEST' },
      });
    });

    it('doit déplacer un bot sur une case adjacente valide et libérer l ancienne case', () => {
      const grid = new Grid({ width: 6, height: 6 });
      const bot = { id: 1, name: 'Runner' };
      grid.placeBot(bot, { x: 1, y: 1 });

      const moved = grid.moveBot(1, { x: 2, y: 1 });

      assert.equal(moved, true);
      assert.deepEqual(bot.position, { x: 2, y: 1 });
      assert.equal(grid.getBotAt(1, 1), null);
      assert.equal(grid.getBotAt(2, 1)?.id, 1);
      assert.equal(grid.isCellFree(1, 1), true);
    });

    it('doit refuser un déplacement non adjacent ou vers une case occupée / obstacle', () => {
      const grid = new Grid({
        width: 6,
        height: 6,
        obstacles: [{ x: 1, y: 2 }],
      });
      const bot1 = { id: 1, name: 'B1' };
      const bot2 = { id: 2, name: 'B2' };
      grid.placeBot(bot1, { x: 1, y: 1 });
      grid.placeBot(bot2, { x: 2, y: 1 });

      // Non adjacent (téléportation)
      assert.equal(grid.moveBot(1, { x: 4, y: 4 }), false);
      // Sur un obstacle
      assert.equal(grid.moveBot(1, { x: 1, y: 2 }), false);
      // Sur bot 2
      assert.equal(grid.moveBot(1, { x: 2, y: 1 }), false);
      // Position inchangée
      assert.deepEqual(bot1.position, { x: 1, y: 1 });
    });
  });

  describe('Instantané d état (Snapshot)', () => {
    it('doit générer une représentation complète de la grille', () => {
      const grid = new Grid({
        width: 8,
        height: 6,
        obstacles: [{ x: 3, y: 3 }],
      });
      const bot = { id: 1, name: 'Alpha', hp: 100 };
      grid.placeBot(bot, { x: 1, y: 1 });

      const snapshot = grid.getSnapshot();
      assert.equal(snapshot.width, 8);
      assert.equal(snapshot.height, 6);
      assert.deepEqual(snapshot.obstacles, [{ x: 3, y: 3 }]);
      assert.equal(snapshot.bots.length, 1);
      assert.equal(snapshot.bots[0].id, 1);
      assert.deepEqual(snapshot.bots[0].position, { x: 1, y: 1 });
    });
  });
});
