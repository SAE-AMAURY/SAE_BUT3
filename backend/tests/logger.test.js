import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../services/engine/Grid.js';
import { CombatLoop } from '../services/engine/CombatLoop.js';
import { MatchLogger } from '../services/engine/MatchLogger.js';
import { simulateMatch } from '../services/engine/index.js';

describe('Issue #31 - Moteur : Générateur de logs JSON structurés', () => {
  function createSampleMatch() {
    const grid = new Grid({ width: 8, height: 6, obstacles: [{ x: 3, y: 3 }] });
    const bot1 = { id: 'bot-1', name: 'Alpha', class: 'Guerrier' };
    const bot2 = { id: 'bot-2', name: 'Omega', class: 'Sniper' };
    const combat = new CombatLoop({
      grid,
      bot1,
      bot2,
      maxRounds: 10,
      maxAp: 3,
    });
    combat.initCombat();
    return { grid, bot1, bot2, combat };
  }

  describe('Initialisation des métadonnées du log', () => {
    it('doit initialiser un journal avec métadonnées conformes (grille, bots, matchId)', () => {
      const { grid, bot1, bot2 } = createSampleMatch();
      const logger = new MatchLogger({ matchId: 'match-123' });

      logger.startMatch({
        matchId: 'match-123',
        grid,
        bots: [bot1, bot2],
        maxRounds: 10,
      });

      const log = logger.toJSON();
      assert.ok(log);
      assert.equal(log.metadata.matchId, 'match-123');
      assert.equal(log.metadata.maxRounds, 10);
      assert.equal(log.metadata.grid.width, 8);
      assert.equal(log.metadata.grid.height, 6);
      assert.deepEqual(log.metadata.grid.obstacles, [{ x: 3, y: 3 }]);
      assert.equal(log.metadata.bots.length, 2);
      assert.equal(log.metadata.bots[0].id, 'bot-1');
      assert.equal(log.metadata.bots[1].id, 'bot-2');
      assert.deepEqual(log.rounds, []);
      assert.equal(log.result, null);
    });
  });

  describe('Enregistrement des rounds et actions (turns & events)', () => {
    it('doit consigner les rounds et les actions avec leurs événements et états', () => {
      const { grid, bot1, bot2, combat } = createSampleMatch();
      const logger = new MatchLogger({ matchId: 'match-xyz' });
      logger.startMatch({
        matchId: 'match-xyz',
        grid,
        bots: [bot1, bot2],
        maxRounds: 5,
      });

      logger.startRound(1);

      // Bot 1 se déplace
      const moveRes = combat.executeAction('bot-1', {
        type: 'MOVE',
        target: { x: 2, y: 3 },
      });
      logger.logTurn({
        botId: 'bot-1',
        action: { type: 'MOVE', target: { x: 2, y: 3 } },
        result: moveRes,
        events: [
          {
            type: 'BOT_MOVED',
            botId: 'bot-1',
            from: { x: 1, y: 3 },
            to: { x: 2, y: 3 },
          },
        ],
        botStates: [
          { id: 'bot-1', hp: 100, ap: 2, position: { x: 2, y: 3 } },
          { id: 'bot-2', hp: 70, ap: 3, position: { x: 6, y: 3 } },
        ],
      });

      const log = logger.toJSON();
      assert.equal(log.rounds.length, 1);
      assert.equal(log.rounds[0].roundNumber, 1);
      assert.equal(log.rounds[0].turns.length, 1);

      const turn = log.rounds[0].turns[0];
      assert.equal(turn.botId, 'bot-1');
      assert.equal(turn.action.type, 'MOVE');
      assert.equal(turn.result.success, true);
      assert.equal(turn.events[0].type, 'BOT_MOVED');
      assert.equal(turn.snapshot.length, 2);
    });
  });

  describe('Clôture du match et export JSON', () => {
    it('doit finaliser le log avec le vainqueur et la raison d arrêt', () => {
      const { grid, bot1, bot2 } = createSampleMatch();
      const logger = new MatchLogger({ matchId: 'match-final' });
      logger.startMatch({
        matchId: 'match-final',
        grid,
        bots: [bot1, bot2],
        maxRounds: 5,
      });

      logger.startRound(1);
      logger.endMatch({
        winnerId: 'bot-1',
        reason: 'ELIMINATION',
        finalBots: [
          { id: 'bot-1', hp: 100, isAlive: true },
          { id: 'bot-2', hp: 0, isAlive: false },
        ],
      });

      const log = logger.toJSON();
      assert.ok(log.result);
      assert.equal(log.result.winnerId, 'bot-1');
      assert.equal(log.result.reason, 'ELIMINATION');
      assert.equal(log.result.totalRounds, 1);
      assert.equal(log.result.finalBots[1].hp, 0);
    });

    it('doit sérialiser le rapport sous forme de chaîne JSON valide (toString)', () => {
      const { grid, bot1, bot2 } = createSampleMatch();
      const logger = new MatchLogger({ matchId: 'm-json' });
      logger.startMatch({
        matchId: 'm-json',
        grid,
        bots: [bot1, bot2],
        maxRounds: 5,
      });
      logger.endMatch({ winnerId: null, reason: 'MAX_ROUNDS_REACHED' });

      const jsonStr = logger.toString();
      assert.equal(typeof jsonStr, 'string');
      const parsed = JSON.parse(jsonStr);
      assert.equal(parsed.metadata.matchId, 'm-json');
      assert.equal(parsed.result.reason, 'MAX_ROUNDS_REACHED');
    });

    it('doit simuler une partie complète via la façade et générer un replay JSON complet', () => {
      const bot1 = { id: 'bot-warrior', name: 'Guerrier1', class: 'Guerrier' };
      const bot2 = { id: 'bot-tank', name: 'Tank1', class: 'Tank' };

      const result = simulateMatch({
        bot1,
        bot2,
        gridOptions: { width: 8, height: 6 },
        matchId: 'sim-test-1',
        maxRounds: 3,
        decisionFn1: () => ({ type: 'PASS' }),
        decisionFn2: () => ({ type: 'PASS' }),
      });

      assert.ok(result.log);
      assert.equal(result.log.metadata.matchId, 'sim-test-1');
      assert.equal(result.log.metadata.maxRounds, 3);
      assert.equal(result.log.rounds.length > 0, true);
      assert.ok(result.log.result);
      assert.equal(result.finishReason, 'MAX_ROUNDS_REACHED');
    });
  });
});
