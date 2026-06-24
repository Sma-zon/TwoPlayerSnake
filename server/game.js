const GRID_WIDTH = 30;
const GRID_HEIGHT = 20;

function randomEmptyCell(snake, exclude) {
  const occupied = new Set(
    snake.map((s) => `${s.x},${s.y}`)
  );
  if (exclude) occupied.add(`${exclude.x},${exclude.y}`);

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

class Game {
  constructor() {
    this.reset();
  }

  reset() {
    this.snake = createInitialSnake();
    this.direction = { x: 1, y: 0 };
    this.pendingDirection = { x: 1, y: 0 };
    this.apple = randomEmptyCell(this.snake);
    this.appleDirection = { x: 0, y: 0 };
    this.pendingAppleDirection = { x: 0, y: 0 };
    this.score = 0;
    this.gameOver = false;
    this.winner = null;
    this.tickCount = 0;
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

  tickSnake() {
    if (this.gameOver) return;

    this.direction = { ...this.pendingDirection };
    const head = this.snake[0];
    const newHead = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y,
    };

    if (
      newHead.x < 0 ||
      newHead.x >= GRID_WIDTH ||
      newHead.y < 0 ||
      newHead.y >= GRID_HEIGHT
    ) {
      this.endGame("apple");
      return;
    }

    if (this.snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      this.endGame("apple");
      return;
    }

    this.snake.unshift(newHead);

    if (newHead.x === this.apple.x && newHead.y === this.apple.y) {
      this.score += 1;
      this.apple = randomEmptyCell(this.snake);
      this.appleDirection = { x: 0, y: 0 };
      this.pendingAppleDirection = { x: 0, y: 0 };
    } else {
      this.snake.pop();
    }
  }

  tickApple() {
    if (this.gameOver) return;

    this.appleDirection = { ...this.pendingAppleDirection };
    if (this.appleDirection.x === 0 && this.appleDirection.y === 0) return;

    const next = {
      x: this.apple.x + this.appleDirection.x,
      y: this.apple.y + this.appleDirection.y,
    };

    if (
      next.x < 0 ||
      next.x >= GRID_WIDTH ||
      next.y < 0 ||
      next.y >= GRID_HEIGHT
    ) {
      return;
    }

    if (this.snake.some((s) => s.x === next.x && s.y === next.y)) {
      return;
    }

    this.apple = next;
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
      score: this.score,
      gameOver: this.gameOver,
      winner: this.winner,
    };
  }
}

module.exports = { Game, GRID_WIDTH, GRID_HEIGHT };
