/**
 * Boucle de combat tour par tour du jeu CodeArena.
 * Issue #30 : Points d'action, calcul des dégâts et points de vie.
 */
export const DEFAULT_CLASSES = {
  Guerrier: { name: 'Guerrier', baseHealth: 100, baseRange: 1, baseDamage: 25 },
  Tank: { name: 'Tank', baseHealth: 160, baseRange: 1, baseDamage: 15 },
  Sniper: { name: 'Sniper', baseHealth: 70, baseRange: 4, baseDamage: 35 },
};

export const ACTION_COSTS = {
  MOVE: 1,
  ATTACK: 2,
  PASS: 0,
};

export class CombatLoop {
  constructor({ grid, bot1, bot2, maxRounds = 50, maxAp = 3 } = {}) {
    this.grid = grid;
    this.bot1 = bot1;
    this.bot2 = bot2;
    this.maxRounds = maxRounds;
    this.maxAp = maxAp;
    this.roundNumber = 1;
    this.status = 'READY'; // 'READY' | 'IN_PROGRESS' | 'FINISHED'
    this.activeBot = null;
    this.winner = null;
    this.finishReason = null;
  }

  initCombat() {
    this._setupBotStats(this.bot1);
    this._setupBotStats(this.bot2);

    this.grid.setInitialPositions(this.bot1, this.bot2);

    this.roundNumber = 1;
    this.status = 'IN_PROGRESS';
    this.activeBot = this.bot1;
    this.winner = null;
    this.finishReason = null;
    return true;
  }

  _setupBotStats(bot) {
    const classData = DEFAULT_CLASSES[bot.class] || {
      name: bot.class || 'Custom',
      baseHealth: 100,
      baseRange: 1,
      baseDamage: 20,
    };

    bot.maxHp = bot.maxHp ?? classData.baseHealth;
    bot.hp = bot.hp ?? bot.maxHp;
    bot.range = bot.range ?? classData.baseRange;
    bot.damage = bot.damage ?? classData.baseDamage;
    bot.maxAp = bot.maxAp ?? this.maxAp;
    bot.ap = bot.maxAp;
    bot.isAlive = bot.hp > 0;
  }

  getActiveBot() {
    return this.activeBot;
  }

  getOpponent(botId) {
    if (botId === this.bot1?.id) return this.bot2;
    if (botId === this.bot2?.id) return this.bot1;
    return null;
  }

  isGameOver() {
    return this.status === 'FINISHED';
  }

  checkWinConditions() {
    if (!this.bot1.isAlive && !this.bot2.isAlive) {
      this.status = 'FINISHED';
      this.winner = null;
      this.finishReason = 'DOUBLE_KO';
      return true;
    }

    if (!this.bot2.isAlive) {
      this.status = 'FINISHED';
      this.winner = this.bot1;
      this.finishReason = 'ELIMINATION';
      return true;
    }

    if (!this.bot1.isAlive) {
      this.status = 'FINISHED';
      this.winner = this.bot2;
      this.finishReason = 'ELIMINATION';
      return true;
    }

    if (this.roundNumber > this.maxRounds) {
      this.status = 'FINISHED';
      this.finishReason = 'MAX_ROUNDS_REACHED';
      if (this.bot1.hp > this.bot2.hp) {
        this.winner = this.bot1;
      } else if (this.bot2.hp > this.bot1.hp) {
        this.winner = this.bot2;
      } else {
        this.winner = null;
      }
      return true;
    }

    return false;
  }

  nextTurn() {
    if (this.isGameOver()) return false;

    if (this.activeBot.id === this.bot1.id) {
      this.activeBot = this.bot2;
    } else {
      // Fin du round pour les deux bots
      this.roundNumber += 1;
      if (this.roundNumber > this.maxRounds) {
        this.checkWinConditions();
        return false;
      }
      // Réinitialisation des PA
      this.bot1.ap = this.bot1.maxAp;
      this.bot2.ap = this.bot2.maxAp;
      this.activeBot = this.bot1;
    }

    return true;
  }

  executeAction(botId, action) {
    if (this.status !== 'IN_PROGRESS') {
      return { success: false, reason: 'GAME_NOT_IN_PROGRESS' };
    }

    if (this.activeBot?.id !== botId) {
      return { success: false, reason: 'NOT_YOUR_TURN' };
    }

    const bot = this.activeBot;
    if (!bot.isAlive) {
      return { success: false, reason: 'BOT_DEAD' };
    }

    const actionType = action?.type?.toUpperCase();
    const cost = ACTION_COSTS[actionType];

    if (cost === undefined) {
      return { success: false, reason: 'INVALID_ACTION_TYPE' };
    }

    if (actionType === 'PASS') {
      bot.ap = 0;
      this.nextTurn();
      return { success: true, action: 'PASS' };
    }

    if (bot.ap < cost) {
      return { success: false, reason: 'INSUFFICIENT_AP' };
    }

    if (actionType === 'MOVE') {
      let targetPos = action.target;
      if (!targetPos && action.direction) {
        const dir = action.direction.toUpperCase();
        const deltaMap = {
          UP: { x: 0, y: -1 },
          DOWN: { x: 0, y: 1 },
          LEFT: { x: -1, y: 0 },
          RIGHT: { x: 1, y: 0 },
          NORTH: { x: 0, y: -1 },
          SOUTH: { x: 0, y: 1 },
          WEST: { x: -1, y: 0 },
          EAST: { x: 1, y: 0 },
        };
        const delta = deltaMap[dir];
        if (!delta) return { success: false, reason: 'INVALID_DIRECTION' };
        targetPos = {
          x: bot.position.x + delta.x,
          y: bot.position.y + delta.y,
        };
      }

      if (!targetPos) {
        return { success: false, reason: 'MISSING_TARGET_OR_DIRECTION' };
      }

      const moved = this.grid.moveBot(bot.id, targetPos);
      if (!moved) {
        return { success: false, reason: 'ILLEGAL_MOVE' };
      }

      bot.ap -= cost;
      if (action.direction) bot.direction = action.direction;

      if (bot.ap === 0) {
        this.nextTurn();
      }

      return {
        success: true,
        action: 'MOVE',
        position: { ...bot.position },
        apRemaining: bot.ap,
      };
    }

    if (actionType === 'ATTACK') {
      const opponent = this.getOpponent(bot.id);
      if (!opponent || !opponent.isAlive) {
        return { success: false, reason: 'NO_TARGET' };
      }

      if (action.targetId && action.targetId !== opponent.id) {
        return { success: false, reason: 'INVALID_TARGET_ID' };
      }

      const dist = this.grid.getDistance(bot.position, opponent.position);
      if (dist > bot.range) {
        return {
          success: false,
          reason: 'OUT_OF_RANGE',
          distance: dist,
          range: bot.range,
        };
      }

      bot.ap -= cost;
      const damage = bot.damage;
      opponent.hp = Math.max(0, opponent.hp - damage);
      if (opponent.hp === 0) {
        opponent.isAlive = false;
      }

      const gameOver = this.checkWinConditions();

      if (!gameOver && bot.ap === 0) {
        this.nextTurn();
      }

      return {
        success: true,
        action: 'ATTACK',
        targetId: opponent.id,
        damage,
        targetHp: opponent.hp,
        apRemaining: bot.ap,
        elimination: !opponent.isAlive,
      };
    }

    return { success: false, reason: 'UNKNOWN_ACTION' };
  }
}
