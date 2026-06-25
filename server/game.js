const GRID_WIDTH = 30;
const GRID_HEIGHT = 20;
const APPLE_TYPES = [
  "speed",
  "fire",
  "ghost",
  "clone",
  "teleport",
  "mirror",
  "green",
];

function randomEmptyCell(snake, exclude = []) {
  const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
  for (const item of exclude) {
    if (item && typeof item.x === "number" && typeof item.y === "number") {
      occupied.add(`${item.x},${item.y}`);
    }
  }

  const free = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  return free[Math.floor(Math.random() * free.length)];
}

function createInitialSnake() {
  const cx = Math.floor(GRID_WIDTH / 2);
  const cy = Math.floor(GRID_HEIGHT / 2);
  return [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
}

function randomAppleType() {
  return APPLE_TYPES[Math.floor(Math.random() * APPLE_TYPES.length)];
}

function randomTeleportPosition(snake, direction) {
  const candidates = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tooClose =
        x === snake[0].x + direction.x &&
        y === snake[0].y + direction.y;
      if (tooClose) continue;
      if (!snake.some((s) => s.x === x && s.y === y)) {
        candidates.push({ x, y });
      }
    }
  }
  return candidates[Math.floor(Math.random() * candidates.length)] || {
    x: Math.floor(Math.random() * GRID_WIDTH),
    y: Math.floor(Math.random() * GRID_HEIGHT),
  };
}

function createStealerSnake(snake, apple, bonusApple) {
  const start = randomEmptyCell(snake, [apple, bonusApple]);
  const body = [start];
  const length = Math.max(3, snake.length);
  for (let i = 1; i < length; i += 1) {
    body.push({ x: (start.x - i + GRID_WIDTH) % GRID_WIDTH, y: start.y });
  }
  return {
    body,
    direction: { x: 1, y: 0 },
    growth: 0,
  };
}

class Game {
  constructor() {
    this.reset();
  }

  reset() {
    this.snake = createInitialSnake();
    this.direction = { x: 1, y: 0 };
    this.pendingDirection = { x: 1, y: 0 };
    this.appleDirection = { x: 0, y: 0 };
    this.pendingAppleDirection = { x: 0, y: 0 };
    this.appleWallCooldownExpiresAt = 0;
    this.score = 0;
    this.gameOver = false;
    this.winner = null;
    this.speedBoostUntil = 0;
    this.deathImmuneUntil = 0;
    this.fireTrailActiveUntil = 0;
    this.reverseSwapUntil = 0;
    this.nextSwapAt = 0;
    this.mirroredControlsUntil = 0;
    this.stealer = null;
    this.stealerUntil = 0;
    this.fireTrail = [];
    this.snakeFireTrail = [];
    this.apple = this.createApple();
    this.bonusApple = null;
  }

  setSnakeDirection(dir) {
    if (this.gameOver) return;
    const opposite =
      dir.x === -this.direction.x && dir.y === -this.direction.y;
    if (!opposite) {
      this.pendingDirection = { ...dir };
    }
  }

  setAppleDirection(dir) {
    if (this.gameOver) return;
    this.pendingAppleDirection = { ...dir };
  }

  wrapCell(pos) {
    return {
      x: (pos.x + GRID_WIDTH) % GRID_WIDTH,
      y: (pos.y + GRID_HEIGHT) % GRID_HEIGHT,
    };
  }

  getOccupiedCells() {
    const cells = [...this.snake];
    if (this.apple) cells.push({ x: this.apple.x, y: this.apple.y });
    if (this.bonusApple) cells.push({ x: this.bonusApple.x, y: this.bonusApple.y });
    if (this.stealer) cells.push(...this.stealer.body);
    return cells;
  }

  createBonusApple(mainApple) {
    return randomEmptyCell(this.snake, [mainApple]);
  }

  createApple() {
    const type = randomAppleType();
    const apple = randomEmptyCell(this.snake, []);
    const result = {
      x: apple.x,
      y: apple.y,
      type,
      spawnedAt: Date.now(),
      nextTeleportAt: Date.now() + 3000,
      nextCloneAt: Date.now() + 2000,
    };
    if (type === "clone") {
      this.bonusApple = this.createBonusApple(result);
    } else {
      this.bonusApple = null;
    }
    return result;
  }

  canUseWallTeleport() {
    return Date.now() >= this.appleWallCooldownExpiresAt;
  }

  isImmune() {
    const now = Date.now();
    return now < this.deathImmuneUntil || now < this.fireTrailActiveUntil;
  }

  isMirrorActive() {
    return Date.now() < this.mirroredControlsUntil;
  }

  isFireActive() {
    return Date.now() < this.fireTrailActiveUntil;
  }

  isSpeedActive() {
    return Date.now() < this.speedBoostUntil;
  }

  isHeadSwapActive() {
    return Date.now() < this.reverseSwapUntil;
  }

  teleportApple() {
    const position = randomTeleportPosition(this.snake, this.direction);
    this.apple.x = position.x;
    this.apple.y = position.y;
    this.apple.nextTeleportAt = Date.now() + 3000;
  }

  updateEffects() {
    const now = Date.now();
    this.fireTrail = this.fireTrail.filter((entry) => entry.expiresAt > now);
    this.snakeFireTrail = this.snakeFireTrail.filter((entry) => entry.expiresAt > now);
    if (this.stealer && now >= this.stealerUntil) {
      this.stealer = null;
    }
    if (this.isHeadSwapActive() && this.nextSwapAt === 0) {
      this.nextSwapAt = now + 6000;
    }
  }

  swapSnakeHeadTail() {
    if (!this.isHeadSwapActive()) return;
    if (Date.now() < this.nextSwapAt) return;
    this.snake.reverse();
    this.direction = { x: -this.direction.x, y: -this.direction.y };
    this.pendingDirection = { ...this.direction };
    this.nextSwapAt = Date.now() + 6000;
  }

  tickSnake() {
    if (this.gameOver) return;

    this.updateEffects();
    this.swapSnakeHeadTail();

    this.direction = { ...this.pendingDirection };
    this.snakeStep();
    if (this.stealer) this.tickStealer();

    if (this.isSpeedActive() && !this.gameOver) {
      this.snakeStep();
      if (this.stealer) this.tickStealer();
    }
  }

  snakeStep() {
    if (this.gameOver) return;

    const head = this.snake[0];
    const newHead = this.wrapCell({
      x: head.x + this.direction.x,
      y: head.y + this.direction.y,
    });

    // If we're stepping onto a bonus apple or the main apple, handle that first
    if (this.bonusApple && newHead.x === this.bonusApple.x && newHead.y === this.bonusApple.y) {
      this.score += 1;
      this.bonusApple = null;
      this.snake.unshift(newHead);
      return;
    }

    if (newHead.x === this.apple.x && newHead.y === this.apple.y) {
      // eat the apple immediately and apply its effects before checking fire collisions
      this.snake.unshift(newHead);
      this.handleAppleEaten();
      return;
    }

    if (!this.isImmune() && this.snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      this.endGame("apple");
      return;
    }

    if (this.stealer && this.stealer.body.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      this.endGame("apple");
      return;
    }

    if (!this.isImmune() && this.fireTrail.some((entry) => entry.x === newHead.x && entry.y === newHead.y)) {
      this.endGame("apple");
      return;
    }

    if (!this.isImmune() && this.snakeFireTrail.some((entry) => entry.x === newHead.x && entry.y === newHead.y)) {
      this.endGame("apple");
      return;
    }

    const oldTail = this.snake[this.snake.length - 1];
    this.snake.unshift(newHead);

    if (this.bonusApple && newHead.x === this.bonusApple.x && newHead.y === this.bonusApple.y) {
      this.score += 1;
      this.bonusApple = null;
      return;
    }

    if (newHead.x === this.apple.x && newHead.y === this.apple.y) {
      this.handleAppleEaten();
      return;
    }

    if (this.isFireActive()) {
      this.snakeFireTrail.push({ x: oldTail.x, y: oldTail.y, expiresAt: Date.now() + 25000 });
    }

    this.snake.pop();
  }

  tickApple() {
    if (this.gameOver) return;

    if (this.apple.type === "teleport" && Date.now() >= this.apple.nextTeleportAt) {
      this.teleportApple();
    }

    this.appleDirection = { ...this.pendingAppleDirection };
    if (this.appleDirection.x === 0 && this.appleDirection.y === 0) return;

    this.performAppleMove();
    if (this.apple.type === "speed") {
      this.performAppleMove();
    }

    const now = Date.now();
    this.fireTrail = this.fireTrail.filter((entry) => entry.expiresAt > now);

    // Handle apple heating when sitting on fire
    if (this.apple.type !== "ghost" && this.fireTrail.some((entry) => entry.x === this.apple.x && entry.y === this.apple.y)) {
      if (!this.apple.heatingAt) this.apple.heatingAt = now;
      else if (now - this.apple.heatingAt >= 5000) {
        // Apple burned to a crisp: spawn a bit of fire and respawn the apple
        this.fireTrail.push({ x: this.apple.x, y: this.apple.y, expiresAt: now + 25000 });
        this.apple = this.createApple();
        return;
      }
    } else {
      if (this.apple.heatingAt) delete this.apple.heatingAt;
    }

    // For clone apples, attempt to spawn a bonus clone apple every 2s if missing
    if (this.apple.type === "clone") {
      if (!this.bonusApple && Date.now() >= (this.apple.nextCloneAt || 0)) {
        this.bonusApple = this.createBonusApple(this.apple);
        this.apple.nextCloneAt = Date.now() + 2000;
      }
    }
  }

  performAppleMove() {
    const prevPos = { x: this.apple.x, y: this.apple.y };
    const proposed = {
      x: this.apple.x + this.appleDirection.x,
      y: this.apple.y + this.appleDirection.y,
    };

    const outOfBounds =
      proposed.x < 0 || proposed.x >= GRID_WIDTH || proposed.y < 0 || proposed.y >= GRID_HEIGHT;
    let next = proposed;

    if (outOfBounds) {
      if (!this.canUseWallTeleport()) return;
      next = this.wrapCell(proposed);
    }

    const hitsSnake = this.snake.some((s) => s.x === next.x && s.y === next.y);
    if (hitsSnake && this.apple.type !== "ghost") {
      return;
    }

    if (this.fireTrail.some((entry) => entry.x === next.x && entry.y === next.y) && this.apple.type !== "ghost") {
      return;
    }

    if (outOfBounds) {
      this.appleWallCooldownExpiresAt = Date.now() + 10000;
    }

    if (this.apple.type === "fire") {
      this.fireTrail.push({ x: prevPos.x, y: prevPos.y, expiresAt: Date.now() + 25000 });
    }

    this.apple.x = next.x;
    this.apple.y = next.y;
  }

  handleAppleEaten() {
    this.score += 1;
    const type = this.apple.type;

    if (type === "speed") {
      this.speedBoostUntil = Date.now() + 10000;
    } else if (type === "fire") {
      this.fireTrailActiveUntil = Date.now() + 10000;
      // Grant temporary immunity from fire when eating a fire apple
      this.deathImmuneUntil = Date.now() + 10000;
    } else if (type === "ghost") {
      this.deathImmuneUntil = Date.now() + 10000;
    } else if (type === "clone") {
      this.bonusApple = null;
      this.stealer = createStealerSnake(this.snake, this.apple, this.bonusApple);
      this.stealerUntil = Date.now() + 15000;
    } else if (type === "teleport") {
      this.reverseSwapUntil = Date.now() + 30000;
      this.nextSwapAt = Date.now() + 6000;
    } else if (type === "mirror") {
      this.mirroredControlsUntil = Date.now() + 10000;
    } else if (type === "green") {
      if (Math.random() < 0.5) {
        this.extendSnake(5);
      } else {
        this.shrinkSnake(5);
      }
    }

    this.apple = this.createApple();
  }

  extendSnake(amount) {
    const tail = this.snake[this.snake.length - 1];
    for (let i = 0; i < amount; i += 1) {
      this.snake.push({ x: tail.x, y: tail.y });
    }
  }

  shrinkSnake(amount) {
    for (let i = 0; i < amount; i += 1) {
      if (this.snake.length <= 3) break;
      this.snake.pop();
    }
  }

  createStealerSnake(snake, apple, bonusApple) {
    return createStealerSnake(snake, apple, bonusApple);
  }

  tickStealer() {
    if (!this.stealer) return;
    const target = this.bonusApple || this.apple;
    if (!target) return;

    const head = this.stealer.body[0];
    const dx = Math.sign(target.x - head.x);
    const dy = Math.sign(target.y - head.y);
    // move only in one axis per tick to avoid diagonal movement
    let moveX = 0;
    let moveY = 0;
    if (dx !== 0) {
      moveX = dx;
    } else if (dy !== 0) {
      moveY = dy;
    } else {
      moveX = this.stealer.direction.x || 0;
      moveY = this.stealer.direction.y || 0;
    }
    const next = this.wrapCell({ x: head.x + moveX, y: head.y + moveY });

    const ateBonus = this.bonusApple && next.x === this.bonusApple.x && next.y === this.bonusApple.y;
    const ateApple = next.x === this.apple.x && next.y === this.apple.y;

    // If stealer moves into the snake, the snake should lose
    if (this.snake.some((s) => s.x === next.x && s.y === next.y)) {
      this.endGame("apple");
      return;
    }

    // Move the stealer: add new head. If it did not eat anything, remove tail so length stays same.
    this.stealer.body.unshift(next);
    if (!ateBonus && !ateApple) {
      this.stealer.body.pop();
    }

    this.stealer.direction = { x: next.x - head.x, y: next.y - head.y };

    if (ateBonus) {
      this.bonusApple = null;
    }

    if (ateApple) {
      // capture eaten apple type before creating a new apple
      const eatenType = this.apple.type;
      // apply effects to the stealer so it gains powers independently
      if (eatenType === "speed") {
        this.stealer.speedBoostUntil = Date.now() + 10000;
      } else if (eatenType === "fire") {
        this.stealer.fireTrailActiveUntil = Date.now() + 10000;
      } else if (eatenType === "ghost") {
        this.stealer.deathImmuneUntil = Date.now() + 10000;
      } else if (eatenType === "mirror") {
        this.stealer.mirroredControlsUntil = Date.now() + 10000;
      } else if (eatenType === "teleport") {
        this.stealer.reverseSwapUntil = Date.now() + 30000;
        this.stealer.nextSwapAt = Date.now() + 6000;
      } else if (eatenType === "green") {
        if (Math.random() < 0.5) {
          // grow stealer
          const tail = this.stealer.body[this.stealer.body.length - 1];
          for (let i = 0; i < 5; i += 1) this.stealer.body.push({ x: tail.x, y: tail.y });
        } else {
          // shrink stealer
          for (let i = 0; i < 5; i += 1) {
            if (this.stealer.body.length <= 3) break;
            this.stealer.body.pop();
          }
        }
      }

      this.apple = this.createApple();
    }

    // If stealer has its own speed boost, let it take an extra step immediately
    if (this.stealer.speedBoostUntil && Date.now() < this.stealer.speedBoostUntil) {
      const head2 = this.stealer.body[0];
      const dx2 = Math.sign((this.bonusApple || this.apple).x - head2.x);
      const dy2 = Math.sign((this.bonusApple || this.apple).y - head2.y);
      let mX2 = 0;
      let mY2 = 0;
      if (dx2 !== 0) {
        mX2 = dx2;
      } else if (dy2 !== 0) {
        mY2 = dy2;
      } else {
        mX2 = this.stealer.direction.x || 0;
        mY2 = this.stealer.direction.y || 0;
      }
      const next2 = this.wrapCell({ x: head2.x + mX2, y: head2.y + mY2 });
      const ateBonus2 = this.bonusApple && next2.x === this.bonusApple.x && next2.y === this.bonusApple.y;
      const ateApple2 = next2.x === this.apple.x && next2.y === this.apple.y;
      if (this.snake.some((s) => s.x === next2.x && s.y === next2.y)) {
        this.endGame("apple");
        return;
      }
      this.stealer.body.unshift(next2);
      if (!ateBonus2 && !ateApple2) this.stealer.body.pop();
      this.stealer.direction = { x: next2.x - head2.x, y: next2.y - head2.y };
      if (ateBonus2) this.bonusApple = null;
      if (ateApple2) this.apple = this.createApple();
    }
  }

  endGame(winner) {
    this.gameOver = true;
    this.winner = winner;
  }

  getState() {
    return {
      gridWidth: GRID_WIDTH,
      gridHeight: GRID_HEIGHT,
      snake: this.snake,
      apple: this.apple,
      bonusApple: this.bonusApple,
      fireTrail: this.fireTrail,
      snakeFireTrail: this.snakeFireTrail,
      stealer: this.stealer,
      score: this.score,
      gameOver: this.gameOver,
      winner: this.winner,
      appleCooldownMs: Math.max(0, this.appleWallCooldownExpiresAt - Date.now()),
      speedBoostMs: Math.max(0, this.speedBoostUntil - Date.now()),
      deathImmuneMs: Math.max(0, this.deathImmuneUntil - Date.now()),
      fireTrailMs: Math.max(0, this.fireTrailActiveUntil - Date.now()),
      reverseMs: Math.max(0, this.reverseSwapUntil - Date.now()),
      mirrorMs: Math.max(0, this.mirroredControlsUntil - Date.now()),
    };
  }
}

module.exports = { Game, GRID_WIDTH, GRID_HEIGHT };
