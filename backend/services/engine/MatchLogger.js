/**
 * Générateur de logs JSON structurés de match CodeArena.
 * Issue #31 : Exporter le déroulé complet de la partie sous forme d'un objet JSON structuré.
 */
export class MatchLogger {
  constructor({ matchId = null } = {}) {
    this.matchId = matchId || `match_${Date.now()}`;
    this.log = null;
    this.currentRound = null;
    this.stepCounter = 0;
  }

  startMatch({ matchId, grid, bots = [], maxRounds = 50 }) {
    this.matchId = matchId || this.matchId;
    this.stepCounter = 0;

    this.log = {
      metadata: {
        matchId: this.matchId,
        date: new Date().toISOString(),
        maxRounds,
        grid: {
          width: grid?.width ?? 10,
          height: grid?.height ?? 10,
          obstacles: grid?.obstacles
            ? grid.obstacles.map((o) => ({ ...o }))
            : [],
        },
        bots: bots.map((b) => ({
          id: b.id,
          name: b.name,
          class: b.class,
          maxHp: b.maxHp,
          range: b.range,
          damage: b.damage,
          maxAp: b.maxAp,
          initialPosition: b.position ? { ...b.position } : null,
          initialDirection: b.direction || 'EAST',
        })),
      },
      rounds: [],
      result: null,
    };

    return true;
  }

  startRound(roundNumber) {
    if (!this.log) {
      throw new Error('Le match doit être démarré avant de consigner un round');
    }

    let round = this.log.rounds.find((r) => r.roundNumber === roundNumber);
    if (!round) {
      round = {
        roundNumber,
        turns: [],
      };
      this.log.rounds.push(round);
    }
    this.currentRound = round;
    return round;
  }

  logTurn({ botId, action, result, events = [], botStates = [] }) {
    if (!this.log) {
      throw new Error('Le match doit être démarré avant de consigner un tour');
    }

    if (!this.currentRound) {
      this.startRound(1);
    }

    this.stepCounter += 1;

    const turnEntry = {
      step: this.stepCounter,
      botId,
      action: action ? { ...action } : {},
      result: result ? { ...result } : {},
      events: events.map((e) => ({ ...e })),
      snapshot: botStates.map((b) => ({
        id: b.id,
        hp: b.hp,
        ap: b.ap,
        position: b.position ? { ...b.position } : null,
        direction: b.direction || 'EAST',
        isAlive: b.isAlive !== false && (b.hp === undefined || b.hp > 0),
      })),
    };

    this.currentRound.turns.push(turnEntry);
    return turnEntry;
  }

  endMatch({ winnerId = null, reason = 'UNKNOWN', finalBots = [] } = {}) {
    if (!this.log) {
      throw new Error('Le match doit être démarré avant d être clôturé');
    }

    this.log.result = {
      winnerId,
      reason,
      totalRounds: this.log.rounds.length,
      finalBots: finalBots.map((b) => ({
        id: b.id,
        hp: b.hp,
        isAlive: b.isAlive !== false && (b.hp === undefined || b.hp > 0),
        position: b.position ? { ...b.position } : null,
      })),
    };

    return this.log.result;
  }

  toJSON() {
    return this.log ? JSON.parse(JSON.stringify(this.log)) : null;
  }

  toString(pretty = false) {
    return this.log ? JSON.stringify(this.log, null, pretty ? 2 : 0) : '';
  }
}
