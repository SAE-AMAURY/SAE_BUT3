/**
 * Modélisation de la grille 2D du jeu CodeArena.
 * Issue #29 : Matrice de jeu (coordonnées X/Y) et positionnement initial.
 */
export class Grid {
  constructor({ width = 10, height = 10, obstacles = [] } = {}) {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new Error('Dimensions de grille invalides');
    }

    this.width = width;
    this.height = height;
    this.obstacles = obstacles.map((obs) => ({ x: obs.x, y: obs.y }));
    this.obstacleKeySet = new Set(this.obstacles.map((o) => `${o.x},${o.y}`));

    this.bots = new Map();
    this.occupiedCells = new Map(); // "x,y" => botId
  }

  isWithinBounds(x, y) {
    return (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      x < this.width &&
      y >= 0 &&
      y < this.height
    );
  }

  isObstacle(x, y) {
    return this.obstacleKeySet.has(`${x},${y}`);
  }

  isCellFree(x, y) {
    return (
      this.isWithinBounds(x, y) &&
      !this.isObstacle(x, y) &&
      !this.occupiedCells.has(`${x},${y}`)
    );
  }

  getDistance(posA, posB) {
    return Math.abs(posA.x - posB.x) + Math.abs(posA.y - posB.y);
  }

  placeBot(bot, position) {
    if (!position || !this.isCellFree(position.x, position.y)) {
      return false;
    }

    // Libérer l'ancienne case si le bot était déjà placé
    if (this.bots.has(bot.id)) {
      const oldPos = this.bots.get(bot.id).position;
      if (oldPos) {
        this.occupiedCells.delete(`${oldPos.x},${oldPos.y}`);
      }
    }

    bot.position = { x: position.x, y: position.y };
    this.bots.set(bot.id, bot);
    this.occupiedCells.set(`${position.x},${position.y}`, bot.id);
    return true;
  }

  getBotAt(x, y) {
    const botId = this.occupiedCells.get(`${x},${y}`);
    if (botId === undefined) return null;
    return this.bots.get(botId) || null;
  }

  getBotById(id) {
    return this.bots.get(id) || null;
  }

  moveBot(botId, targetPos) {
    const bot = this.bots.get(botId);
    if (!bot || !bot.position) return false;

    if (!this.isWithinBounds(targetPos.x, targetPos.y)) return false;
    if (this.isObstacle(targetPos.x, targetPos.y)) return false;
    if (!this.isCellFree(targetPos.x, targetPos.y)) return false;

    // Déplacement orthogonal d'une seule case (distance = 1)
    const distance = this.getDistance(bot.position, targetPos);
    if (distance !== 1) return false;

    // Libérer l'ancienne case et occuper la nouvelle
    this.occupiedCells.delete(`${bot.position.x},${bot.position.y}`);
    bot.position = { x: targetPos.x, y: targetPos.y };
    this.occupiedCells.set(`${targetPos.x},${targetPos.y}`, bot.id);

    return true;
  }

  setInitialPositions(bot1, bot2) {
    const midY = Math.floor(this.height / 2);
    const pos1 = { x: 1, y: midY };
    const pos2 = { x: this.width - 2, y: midY };

    bot1.direction = 'EAST';
    bot2.direction = 'WEST';

    this.placeBot(bot1, pos1);
    this.placeBot(bot2, pos2);

    return {
      bot1: { ...pos1, direction: 'EAST' },
      bot2: { ...pos2, direction: 'WEST' },
    };
  }

  getSnapshot() {
    return {
      width: this.width,
      height: this.height,
      obstacles: this.obstacles.map((o) => ({ ...o })),
      bots: Array.from(this.bots.values()).map((b) => ({
        id: b.id,
        name: b.name,
        position: b.position ? { ...b.position } : null,
        direction: b.direction || 'EAST',
        hp: b.hp,
      })),
    };
  }
}
