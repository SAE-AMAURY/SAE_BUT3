import { Grid } from './Grid.js';
import { CombatLoop, DEFAULT_CLASSES, ACTION_COSTS } from './CombatLoop.js';
import { MatchLogger } from './MatchLogger.js';

export { Grid, CombatLoop, MatchLogger, DEFAULT_CLASSES, ACTION_COSTS };

/**
 * Façade de simulation d'une partie complète entre deux bots.
 * Intègre Grid, CombatLoop et MatchLogger pour produire le replay JSON.
 *
 * @param {Object} params
 * @param {Object} params.bot1 - Données bot 1 ({ id, name, class, ... })
 * @param {Object} params.bot2 - Données bot 2 ({ id, name, class, ... })
 * @param {Object} [params.gridOptions] - Dimensions et obstacles ({ width, height, obstacles })
 * @param {string} [params.matchId] - Identifiant unique du match
 * @param {number} [params.maxRounds=50] - Nombre maximal de rounds
 * @param {Function} [params.decisionFn1] - Fonction de décision pour bot 1 : (state) => action
 * @param {Function} [params.decisionFn2] - Fonction de décision pour bot 2 : (state) => action
 * @returns {{ log: Object, winner: Object|null, finishReason: string }}
 */
export function simulateMatch({
  bot1,
  bot2,
  gridOptions = { width: 10, height: 6 },
  matchId = null,
  maxRounds = 50,
  decisionFn1 = null,
  decisionFn2 = null,
} = {}) {
  const grid = new Grid(gridOptions);
  const combat = new CombatLoop({ grid, bot1, bot2, maxRounds });
  combat.initCombat();

  const logger = new MatchLogger({ matchId });
  logger.startMatch({
    matchId,
    grid,
    bots: [bot1, bot2],
    maxRounds,
  });

  const getBotStates = () => [
    {
      id: bot1.id,
      hp: bot1.hp,
      ap: bot1.ap,
      position: { ...bot1.position },
      direction: bot1.direction,
      isAlive: bot1.isAlive,
    },
    {
      id: bot2.id,
      hp: bot2.hp,
      ap: bot2.ap,
      position: { ...bot2.position },
      direction: bot2.direction,
      isAlive: bot2.isAlive,
    },
  ];

  while (!combat.isGameOver() && combat.roundNumber <= maxRounds) {
    const roundNumber = combat.roundNumber;
    logger.startRound(roundNumber);

    const activeBot = combat.getActiveBot();
    const isBot1 = activeBot.id === bot1.id;
    const decisionFn = isBot1 ? decisionFn1 : decisionFn2;

    let action = { type: 'PASS' };
    if (typeof decisionFn === 'function') {
      try {
        action = decisionFn({
          self: { ...activeBot },
          opponent: { ...combat.getOpponent(activeBot.id) },
          grid: grid.getSnapshot(),
          roundNumber,
        }) || { type: 'PASS' };
      } catch {
        action = { type: 'PASS' };
      }
    }

    const previousPos = activeBot.position ? { ...activeBot.position } : null;
    const opponent = combat.getOpponent(activeBot.id);
    const opponentHpBefore = opponent ? opponent.hp : 0;

    const result = combat.executeAction(activeBot.id, action);
    const events = [];

    if (result.success) {
      if (action.type === 'MOVE') {
        events.push({
          type: 'BOT_MOVED',
          botId: activeBot.id,
          from: previousPos,
          to: { ...activeBot.position },
          direction: activeBot.direction,
        });
      } else if (action.type === 'ATTACK') {
        events.push({
          type: 'ATTACK_RESOLVED',
          attackerId: activeBot.id,
          targetId: opponent?.id,
          damage: result.damage,
          remainingHp: opponent?.hp,
        });
        if (result.elimination) {
          events.push({
            type: 'BOT_ELIMINATED',
            botId: opponent?.id,
            eliminatedBy: activeBot.id,
          });
        }
      } else if (action.type === 'PASS') {
        events.push({
          type: 'TURN_PASSED',
          botId: activeBot.id,
        });
      }
    }

    logger.logTurn({
      botId: activeBot.id,
      action,
      result,
      events,
      botStates: getBotStates(),
    });
  }

  logger.endMatch({
    winnerId: combat.winner ? combat.winner.id : null,
    reason:
      combat.finishReason ||
      (combat.winner ? 'ELIMINATION' : 'MAX_ROUNDS_REACHED'),
    finalBots: getBotStates(),
  });

  return {
    log: logger.toJSON(),
    winner: combat.winner,
    finishReason: combat.finishReason,
  };
}
