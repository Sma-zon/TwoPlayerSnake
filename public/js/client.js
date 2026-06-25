const VERSION = "1.0.5";
const GRID_WIDTH = 30;
const GRID_HEIGHT = 20;

const joinScreen = document.getElementById("join-screen");
const gameScreen = document.getElementById("game-screen");
const versionBadge = document.querySelector(".version-badge");

if (versionBadge) {
  versionBadge.textContent = `v${VERSION}`;
}
const settingsScreen = document.getElementById("settings-screen");
const serverUrlInput = document.getElementById("server-url");
const lobbyCodeInput = document.getElementById("lobby-code");
const joinBtn = document.getElementById("join-btn");
const joinError = document.getElementById("join-error");
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const roleBadge = document.getElementById("role-badge");
const scoreEl = document.getElementById("score");
const lobbyDisplay = document.getElementById("lobby-display");
const snakeStatus = document.getElementById("snake-status");
const appleStatus = document.getElementById("apple-status");
const rolePicker = document.querySelector(".role-picker");
const waitingOverlay = document.getElementById("waiting-overlay");
const waitingText = document.getElementById("waiting-text");
const openSecondTabBtn = document.getElementById("open-second-tab");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const restartBtn = document.getElementById("restart-btn");
const controlsHint = document.getElementById("controls-hint");
const statusText = document.getElementById("status-text");
const lobbyStatus = document.querySelector(".lobby-status");
const boardStyleInput = document.getElementById("board-style");
const boardBgColorInput = document.getElementById("board-bg-color");
const snakeHeadColorInput = document.getElementById("snake-head-color");
const snakeBodyColorInput = document.getElementById("snake-body-color");
const appleColorInput = document.getElementById("apple-color");
const swapControlsInput = document.getElementById("swap-controls");
const settingsBtn = document.getElementById("settings-btn");
const saveSettingsBtn = document.getElementById("save-settings");
const closeSettingsBtn = document.getElementById("close-settings");
const modeInputs = document.querySelectorAll('input[name="mode"]');
const serverAddressLabel = document.getElementById("server-address-label");
const lobbyCodeLabel = document.getElementById("lobby-code-label");

const APPLE_TYPES = [
  "speed",
  "fire",
  "ghost",
  "clone",
  "teleport",
  "mirror",
  "green",
];

function randomAppleType() {
  return APPLE_TYPES[Math.floor(Math.random() * APPLE_TYPES.length)];
}

function randomEmptyCell(snake, exclude = []) {
  const occupied = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
  for (const item of exclude) {
    if (item && typeof item.x === "number" && typeof item.y === "number") {
      occupied.add(`${item.x},${item.y}`);
    }
  }

  const free = [];
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  return free[Math.floor(Math.random() * free.length)];
}

function randomTeleportPosition(snake, direction) {
  const forbidden = {
    x: (snake[0].x + direction.x + GRID_WIDTH) % GRID_WIDTH,
    y: (snake[0].y + direction.y + GRID_HEIGHT) % GRID_HEIGHT,
  };
  const candidates = [];
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      if (x === forbidden.x && y === forbidden.y) continue;
      if (!snake.some((segment) => segment.x === x && segment.y === y)) {
        candidates.push({ x, y });
      }
    }
  }
  if (candidates.length === 0) {
    return { x: Math.floor(Math.random() * GRID_WIDTH), y: Math.floor(Math.random() * GRID_HEIGHT) };
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function createStealerSnake(snake, mainApple, bonusApple) {
  const start = randomEmptyCell(snake, [mainApple, bonusApple]);
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

let socket = null;
let role = null;
let lastState = null;
let gameRunning = false;
let cellSize = 20;
let localMode = false;
let swappedControls = false;
let currentBoardStyle = "grid";
let currentBoardBg = "#111827";
let currentSnakeHead = "#4ade80";
let currentSnakeBody = "#22c55e";
let currentAppleColor = "#ef4444";
let localGame = null;
let localSnakeInterval = null;
let localAppleInterval = null;

const pageParams = new URLSearchParams(window.location.search);
serverUrlInput.value = window.location.origin;

if (pageParams.get("role") === "apple") {
  document.querySelector('input[name="role"][value="apple"]').checked = true;
} else if (pageParams.get("role") === "snake") {
  document.querySelector('input[name="role"][value="snake"]').checked = true;
}

if (pageParams.get("code")) {
  lobbyCodeInput.value = String(pageParams.get("code")).toUpperCase();
}

setLocalMode(document.querySelector('input[name="mode"]:checked').value === "local");
applySettings();

const KEY_TO_DIR = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
  W: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  A: { x: -1, y: 0 },
  D: { x: 1, y: 0 },
};

const SNAKE_KEYS = new Set([
  "w", "a", "s", "d", "W", "A", "S", "D",
]);
const APPLE_KEYS = new Set([
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
]);

class LocalGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.snake = this.createInitialSnake();
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

  createInitialSnake() {
    const cx = Math.floor(GRID_WIDTH / 2);
    const cy = Math.floor(GRID_HEIGHT / 2);
    return [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
  }

  randomEmptyCell(exclude = []) {
    return randomEmptyCell(this.snake, exclude);
  }

  createApple() {
    const type = randomAppleType();
    const base = this.randomEmptyCell();
    const apple = {
      x: base.x,
      y: base.y,
      type,
      spawnedAt: Date.now(),
      nextTeleportAt: Date.now() + 3000,
      nextCloneAt: Date.now() + 2000,
    };
    if (type === "clone") {
      this.bonusApple = this.randomEmptyCell([apple]);
    } else {
      this.bonusApple = null;
    }
    return apple;
  }

  wrapCell(pos) {
    return {
      x: (pos.x + GRID_WIDTH) % GRID_WIDTH,
      y: (pos.y + GRID_HEIGHT) % GRID_HEIGHT,
    };
  }

  canUseWallTeleport() {
    return Date.now() >= this.appleWallCooldownExpiresAt;
  }

  isImmune() {
    const now = Date.now();
    return now < this.deathImmuneUntil || now < this.fireTrailActiveUntil;
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

  updateEffects() {
    const now = Date.now();
    this.fireTrail = this.fireTrail.filter((entry) => entry.expiresAt > now);
    this.snakeFireTrail = this.snakeFireTrail.filter((entry) => entry.expiresAt > now);
    if (this.stealer && now >= this.stealerUntil) {
      this.stealer = null;
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

  setSnakeDirection(dir) {
    const opposite = dir.x === -this.direction.x && dir.y === -this.direction.y;
    if (!opposite) {
      this.pendingDirection = { ...dir };
    }
  }

  setAppleDirection(dir) {
    this.pendingAppleDirection = { ...dir };
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

    // If stepping onto a bonus or the main apple, eat it first so abilities apply
    if (this.bonusApple && newHead.x === this.bonusApple.x && newHead.y === this.bonusApple.y) {
      this.score += 1;
      this.bonusApple = null;
      this.snake.unshift(newHead);
      return;
    }

    if (newHead.x === this.apple.x && newHead.y === this.apple.y) {
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
      const position = randomTeleportPosition(this.snake, this.direction);
      this.apple.x = position.x;
      this.apple.y = position.y;
      this.apple.nextTeleportAt = Date.now() + 5000;
    }

    this.appleDirection = { ...this.pendingAppleDirection };
    if (this.appleDirection.x === 0 && this.appleDirection.y === 0) return;

    this.performAppleMove();
    if (this.apple.type === "speed") {
      this.performAppleMove();
    }

    const now = Date.now();
    this.fireTrail = this.fireTrail.filter((entry) => entry.expiresAt > now);

    // Handle apple heating when sitting on fire (local simulation)
    if (this.apple.type !== "ghost" && this.fireTrail.some((entry) => entry.x === this.apple.x && entry.y === this.apple.y)) {
      if (!this.apple.heatingAt) this.apple.heatingAt = now;
      else if (now - this.apple.heatingAt >= 5000) {
        // Apple burned: spawn fire here and respawn apple
        this.fireTrail.push({ x: this.apple.x, y: this.apple.y, expiresAt: now + 10000 });
        this.apple = this.createApple();
        return;
      }
    } else {
      if (this.apple.heatingAt) delete this.apple.heatingAt;
    }

    // Clone apples should attempt to spawn bonus apples every 2s when missing
    if (this.apple.type === "clone") {
      if (!this.bonusApple && Date.now() >= (this.apple.nextCloneAt || 0)) {
        this.bonusApple = this.randomEmptyCell([this.apple]);
        this.apple.nextCloneAt = Date.now() + 2000;
      }
    }
  }

  performAppleMove() {
    const prev = { x: this.apple.x, y: this.apple.y };
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

    const hitsSnake = this.snake.some((segment) => segment.x === next.x && segment.y === next.y);
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
      this.fireTrail.push({ x: prev.x, y: prev.y, expiresAt: Date.now() + 25000 });
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
      // grant temporary immunity from fire when eating a fire apple (local)
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

  tickStealer() {
    if (!this.stealer) return;
    const target = this.bonusApple || this.apple;
    if (!target) return;

    const head = this.stealer.body[0];
    const dx = target.x === head.x ? 0 : target.x > head.x ? 1 : -1;
    const dy = target.y === head.y ? 0 : target.y > head.y ? 1 : -1;
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

    this.stealer.body.unshift(next);
    this.stealer.body.pop();
    this.stealer.direction = { x: next.x - head.x, y: next.y - head.y };

    const ateBonus = this.bonusApple && next.x === this.bonusApple.x && next.y === this.bonusApple.y;
    const ateApple = next.x === this.apple.x && next.y === this.apple.y;

    this.stealer.body.unshift(next);
    if (!ateBonus && !ateApple) {
      this.stealer.body.pop();
    }

    if (ateBonus) {
      this.bonusApple = null;
    }

    if (ateApple) {
      this.apple = this.createApple();
    }
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
      stealerMs: Math.max(0, this.stealerUntil - Date.now()),
    };
  }

  endGame(winner) {
    this.gameOver = true;
    this.winner = winner;
  }
}

function appleTypeColor(type) {
  switch (type) {
    case "speed":
      return "#60a5fa";
    case "fire":
      return "#f97316";
    case "ghost":
      return "#cbd5e1";
    case "clone":
      return "#f472b6";
    case "teleport":
      return "#8b5cf6";
    case "mirror":
      return "#34d399";
    case "green":
      return "#22c55e";
    default:
      return currentAppleColor;
  }
}

function appleTypeLabel(type) {
  switch (type) {
    case "speed":
      return "S";
    case "fire":
      return "F";
    case "ghost":
      return "G";
    case "clone":
      return "C";
    case "teleport":
      return "T";
    case "mirror":
      return "M";
    case "green":
      return "?";
    default:
      return "A";
  }
}

function drawAppleIcon(type, cx, cy, radius) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineWidth = Math.max(2, radius * 0.12);

  switch (type) {
    case "speed": {
      ctx.fillStyle = "#60a5fa";
      ctx.beginPath();
      ctx.moveTo(-radius * 0.35, -radius * 0.9);
      ctx.lineTo(radius * 0.15, -radius * 0.1);
      ctx.lineTo(-radius * 0.05, -radius * 0.1);
      ctx.lineTo(radius * 0.35, radius * 0.9);
      ctx.lineTo(-radius * 0.3, radius * 0.3);
      ctx.lineTo(radius * 0.05, radius * 0.3);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "fire": {
      const grad = ctx.createRadialGradient(0, -radius * 0.2, radius * 0.1, 0, 0, radius);
      grad.addColorStop(0, "#fed7aa");
      grad.addColorStop(0.5, "#fb923c");
      grad.addColorStop(1, "#f97316");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.9);
      ctx.quadraticCurveTo(radius * 0.6, -radius * 0.2, radius * 0.1, radius * 0.7);
      ctx.quadraticCurveTo(0, radius * 0.5, -radius * 0.25, radius * 0.75);
      ctx.quadraticCurveTo(-radius * 0.6, radius * 0.2, 0, -radius * 0.9);
      ctx.fill();
      break;
    }
    case "ghost": {
      ctx.fillStyle = "rgba(203, 213, 225, 0.95)";
      ctx.beginPath();
      ctx.arc(0, -radius * 0.15, radius * 0.75, Math.PI, 0);
      ctx.lineTo(radius * 0.75, radius * 0.5);
      for (let i = 1; i >= -1; i -= 1) {
        ctx.lineTo(radius * 0.25 * i, radius * 0.1);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-radius * 0.25, -radius * 0.15, radius * 0.15, 0, Math.PI * 2);
      ctx.arc(radius * 0.25, -radius * 0.15, radius * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "clone": {
      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.arc(-radius * 0.2, 0, radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fda4af";
      ctx.beginPath();
      ctx.arc(radius * 0.2, 0, radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "teleport": {
      ctx.strokeStyle = "#8b5cf6";
      ctx.fillStyle = "rgba(139, 92, 246, 0.15)";
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = "#8b5cf6";
      ctx.fill();
      break;
    }
    case "mirror": {
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.arc(-radius * 0.2, 0, radius * 0.65, Math.PI * 0.2, Math.PI * 1.8);
      ctx.fill();
      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.arc(radius * 0.2, 0, radius * 0.65, Math.PI * -0.2, Math.PI * 1.2);
      ctx.fill();
      break;
    }
    case "green": {
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.75, radius * 0.5, Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#16a34a";
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.3);
      ctx.lineTo(radius * 0.1, -radius * 0.85);
      ctx.lineTo(-radius * 0.1, -radius * 0.85);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = currentAppleColor;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

function showError(message) {
  joinError.textContent = message;
  joinError.classList.remove("hidden");
}

function hideError() {
  joinError.classList.add("hidden");
}

function oppositeRole(currentRole) {
  return currentRole === "snake" ? "apple" : "snake";
}

function updateControlHints() {
  if (localMode) {
    controlsHint.textContent = swappedControls
      ? "WASD moves the apple and arrows move the snake. Apple stops when arrow keys are released."
      : "WASD steers the snake and arrows move the apple. Apple stops when arrow keys are released.";
    return;
  }

  if (!role) {
    controlsHint.textContent = "Select a role and connect, or choose Local mode to play on one machine.";
    return;
  }

  if (role === "snake") {
    controlsHint.textContent = "Use WASD to steer the snake. Click the board if keys stop working.";
  } else if (role === "apple") {
    controlsHint.textContent = "Use the arrow keys to move the apple. Hold a key to move, release to stop.";
  } else {
    controlsHint.textContent = "Both roles are taken — you are spectating.";
  }
}

function applySettings() {
  currentBoardStyle = boardStyleInput.value;
  currentBoardBg = boardBgColorInput.value;
  currentSnakeHead = snakeHeadColorInput.value;
  currentSnakeBody = snakeBodyColorInput.value;
  currentAppleColor = appleColorInput.value;
  swappedControls = swapControlsInput.checked;
  updateControlHints();
  if (lastState) render(lastState);
}

function stopLocalLoops() {
  clearInterval(localSnakeInterval);
  clearInterval(localAppleInterval);
  localSnakeInterval = null;
  localAppleInterval = null;
}

function startLocalGame() {
  localGame = new LocalGame();
  role = "local";
  roleBadge.textContent = "Local";
  roleBadge.className = "badge local";
  gameRunning = true;
  lastState = localGame.getState();
  joinScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  waitingOverlay.classList.add("hidden");
  overlay.classList.add("hidden");
  updateControlHints();

  stopLocalLoops();

  localSnakeInterval = setInterval(() => {
    localGame.tickSnake();
    lastState = localGame.getState();
    if (localGame.gameOver) {
      gameRunning = false;
      overlayText.textContent = `Game over — ${localGame.winner === "snake" ? "Snake wins!" : "Apple wins!"} (Score: ${localGame.score})`;
      overlay.classList.remove("hidden");
      stopLocalLoops();
    }
  }, 100);

  localAppleInterval = setInterval(() => {
    localGame.tickApple();
    lastState = localGame.getState();
  }, 150);
}

function resetLocalGame() {
  if (!localGame) return;
  localGame.reset();
  lastState = localGame.getState();
  overlay.classList.add("hidden");
  gameRunning = true;
  updateControlHints();
  stopLocalLoops();
  localSnakeInterval = setInterval(() => {
    localGame.tickSnake();
    lastState = localGame.getState();
    if (localGame.gameOver) {
      gameRunning = false;
      overlayText.textContent = `Game over — ${localGame.winner === "snake" ? "Snake wins!" : "Apple wins!"} (Score: ${localGame.score})`;
      overlay.classList.remove("hidden");
      stopLocalLoops();
    }
  }, 100);
  localAppleInterval = setInterval(() => {
    localGame.tickApple();
    lastState = localGame.getState();
  }, 150);
}

function setLocalMode(enabled) {
  localMode = enabled;
  if (enabled) {
    serverAddressLabel.classList.add("hidden");
    lobbyCodeLabel.classList.add("hidden");
    openSecondTabBtn.classList.add("hidden");
    rolePicker.classList.add("hidden");
    lobbyStatus.classList.add("hidden");
    joinBtn.textContent = "Start local game";
  } else {
    serverAddressLabel.classList.remove("hidden");
    lobbyCodeLabel.classList.remove("hidden");
    openSecondTabBtn.classList.remove("hidden");
    rolePicker.classList.remove("hidden");
    lobbyStatus.classList.remove("hidden");
    joinBtn.textContent = "Connect";
  }
  updateControlHints();
}

function updateWaitingUI(waitingFor) {
  if (gameRunning || !role || role === "spectator") {
    waitingOverlay.classList.add("hidden");
    return;
  }

  if (waitingFor) {
    waitingText.textContent =
      waitingFor === role
        ? "Connected. Waiting for the other player to join…"
        : `Waiting for a ${waitingFor} player to join…`;
    waitingOverlay.classList.remove("hidden");
    return;
  }

  waitingOverlay.classList.add("hidden");
}

function focusBoard() {
  canvas.focus({ preventScroll: true });
}

function connect() {
  if (localMode && localGame && !localGame.gameOver) return;
  if (!localMode && socket?.connected) return;

  hideError();

  if (localMode) {
    startLocalGame();
    focusBoard();
    return;
  }

  const url = serverUrlInput.value.trim() || window.location.origin;
  const requestedRole = document.querySelector('input[name="role"]:checked').value;
  const code = lobbyCodeInput.value.trim().toUpperCase();
  const query = { role: requestedRole };
  if (code) {
    query.code = code;
  }

  joinBtn.disabled = true;
  joinBtn.textContent = "Connecting…";

  socket = io(url, {
    query,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    joinScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    joinBtn.disabled = false;
    joinBtn.textContent = "Connect";
    focusBoard();
  });

  socket.on("connect_error", (err) => {
    showError(`Could not connect: ${err.message}`);
    joinBtn.disabled = false;
    joinBtn.textContent = "Connect";
    socket?.disconnect();
    socket = null;
  });

  socket.on("assigned", ({ role: assignedRole }) => {
    role = assignedRole;
    roleBadge.textContent = assignedRole;
    roleBadge.className = `badge ${assignedRole}`;

    if (assignedRole === "snake") {
      controlsHint.textContent =
        "Use WASD to steer the snake. Click the board if keys stop working.";
    } else if (assignedRole === "apple") {
      controlsHint.textContent =
        "Use the arrow keys to move the apple. Hold a key to move, release to stop.";
    } else {
      controlsHint.textContent = "Both roles are taken — you are spectating.";
    }

    focusBoard();
  });

  socket.on("lobby", ({ code, snakeConnected, appleConnected, gameRunning: running, waitingFor }) => {
    console.log("lobby event", { code, snakeConnected, appleConnected, running, waitingFor });
    snakeStatus.className = `dot ${snakeConnected ? "online" : "offline"}`;
    appleStatus.className = `dot ${appleConnected ? "online" : "offline"}`;
    lobbyDisplay.textContent = code || "—";
    gameRunning = running;
    updateWaitingUI(waitingFor);
  });

  socket.on("state", (state) => {
    lastState = state;
    gameRunning = Boolean(state.gameRunning);
    if (gameRunning) {
      waitingOverlay.classList.add("hidden");
    }
    render(state);
  });

  socket.on("disconnect", (reason) => {
    console.log("socket disconnect", reason);
    gameRunning = false;
    overlayText.textContent = "Disconnected from server.";
    overlay.classList.remove("hidden");
    waitingOverlay.classList.add("hidden");
  });

  socket.on("lobbyCreated", ({ code }) => {
    lobbyDisplay.textContent = code;
    lobbyCodeInput.value = code;
  });

  socket.on("lobbyError", ({ message }) => {
    showError(message || "Unable to join lobby.");
    socket.disconnect();
    socket = null;
  });
}

function render(state) {
  cellSize = canvas.width / state.gridWidth;

  ctx.fillStyle = currentBoardBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (currentBoardStyle === "grid") {
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 1;
    for (let x = 0; x <= state.gridWidth; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= state.gridHeight; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(canvas.width, y * cellSize);
      ctx.stroke();
    }
  } else if (currentBoardStyle === "minimal") {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= state.gridWidth; x += 2) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= state.gridHeight; y += 2) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(canvas.width, y * cellSize);
      ctx.stroke();
    }
  } else if (currentBoardStyle === "solid") {
    // no grid lines when solid style is selected
  }

  if (Array.isArray(state.fireTrail)) {
    ctx.fillStyle = "rgba(248, 113, 113, 0.5)";
    state.fireTrail.forEach((trail) => {
      ctx.fillRect(
        trail.x * cellSize + 2,
        trail.y * cellSize + 2,
        cellSize - 4,
        cellSize - 4
      );
    });
  }

  if (Array.isArray(state.snakeFireTrail)) {
    ctx.fillStyle = "rgba(250, 204, 21, 0.45)";
    state.snakeFireTrail.forEach((trail) => {
      ctx.fillRect(
        trail.x * cellSize + 2,
        trail.y * cellSize + 2,
        cellSize - 4,
        cellSize - 4
      );
    });
  }

  if (state.stealer?.body) {
    ctx.fillStyle = "#f59e0b";
    state.stealer.body.forEach((segment, index) => {
      const inset = index === 0 ? 2 : 4;
      ctx.fillRect(
        segment.x * cellSize + inset,
        segment.y * cellSize + inset,
        cellSize - inset * 2,
        cellSize - inset * 2
      );
    });
  }

  if (state.bonusApple) {
    const bonusPadding = 5;
    ctx.fillStyle = "#f472b6";
    ctx.fillRect(
      state.bonusApple.x * cellSize + bonusPadding,
      state.bonusApple.y * cellSize + bonusPadding,
      cellSize - bonusPadding * 2,
      cellSize - bonusPadding * 2
    );
  }

  state.snake.forEach((segment, i) => {
    const padding = i === 0 ? 1 : 2;
    ctx.fillStyle = i === 0 ? currentSnakeHead : currentSnakeBody;
    ctx.fillRect(
      segment.x * cellSize + padding,
      segment.y * cellSize + padding,
      cellSize - padding * 2,
      cellSize - padding * 2
    );
  });

  const appleRadius = cellSize / 2 - 3;
  drawAppleIcon(state.apple?.type, state.apple.x * cellSize + cellSize / 2, state.apple.y * cellSize + cellSize / 2, appleRadius);

  scoreEl.textContent = state.score;

  const cooldownElement = document.getElementById("cooldown-text");
  if (cooldownElement) {
    if (typeof state.appleCooldownMs === "number" && state.appleCooldownMs > 0) {
      const cooldown = Math.ceil(state.appleCooldownMs / 1000);
      cooldownElement.textContent = `Apple wall teleport cooldown: ${cooldown}s`;
    } else {
      cooldownElement.textContent = "";
    }
  }

  if (statusText) {
    const parts = [];
    if (state.apple?.type) {
      parts.push(`Apple type: ${state.apple.type}`);
    }
    if (typeof state.speedBoostMs === "number" && state.speedBoostMs > 0) {
      parts.push(`Snake speed boost: ${Math.ceil(state.speedBoostMs / 1000)}s`);
    }
    if (typeof state.fireTrailMs === "number" && state.fireTrailMs > 0) {
      parts.push(`Fire trail: ${Math.ceil(state.fireTrailMs / 1000)}s`);
    }
    if (typeof state.deathImmuneMs === "number" && state.deathImmuneMs > 0) {
      parts.push(`Snake is immune: ${Math.ceil(state.deathImmuneMs / 1000)}s`);
    }
    if (typeof state.reverseMs === "number" && state.reverseMs > 0) {
      parts.push(`Teleport mirror active: ${Math.ceil(state.reverseMs / 1000)}s`);
    }
    if (typeof state.mirrorMs === "number" && state.mirrorMs > 0) {
      parts.push(`Controls mirrored: ${Math.ceil(state.mirrorMs / 1000)}s`);
    }
    if (state.bonusApple) {
      parts.push("Clone bonus apple active");
    }
    if (state.stealer?.body) {
      parts.push("Stealer snake chasing apple");
    }
    statusText.textContent = parts.join("\n");
  }

  if (state.gameOver) {
    const winnerLabel =
      state.winner === "snake"
        ? "Snake wins!"
        : state.winner === "apple"
          ? "Apple survives — snake crashed!"
          : "Game over";
    overlayText.textContent = `${winnerLabel} (Score: ${state.score})`;
    overlay.classList.remove("hidden");
  } else {
    overlay.classList.add("hidden");
  }
}

function sendDirection(eventName, dir) {
  if (!socket?.connected) return;
  if (role === "spectator") return;
  socket.emit(eventName, dir);
}

document.addEventListener("keydown", (e) => {
  const dir = KEY_TO_DIR[e.key];
  if (!dir) return;

  if (localMode && localGame) {
    e.preventDefault();
    const isSnakeKey = SNAKE_KEYS.has(e.key);
    const isAppleKey = APPLE_KEYS.has(e.key);

    if (swappedControls) {
      if (isSnakeKey) {
        localGame.setAppleDirection(dir);
      }
      if (isAppleKey) {
        localGame.setSnakeDirection(dir);
      }
    } else {
      if (isSnakeKey) {
        localGame.setSnakeDirection(dir);
      }
      if (isAppleKey) {
        localGame.setAppleDirection(dir);
      }
    }
    return;
  }

  if (role === "snake" && SNAKE_KEYS.has(e.key)) {
    e.preventDefault();
    sendDirection("snakeDirection", dir);
  } else if (role === "apple" && APPLE_KEYS.has(e.key)) {
    e.preventDefault();
    sendDirection("appleDirection", dir);
  }
});

document.addEventListener("keyup", (e) => {
  if (localMode && localGame) {
    const isSnakeKey = SNAKE_KEYS.has(e.key);
    const isAppleKey = APPLE_KEYS.has(e.key);

    if (swappedControls) {
      if (isSnakeKey) {
        localGame.setAppleDirection({ x: 0, y: 0 });
      }
      if (isAppleKey) {
        localGame.setSnakeDirection({ x: 0, y: 0 });
      }
    } else {
      if (isAppleKey) {
        localGame.setAppleDirection({ x: 0, y: 0 });
      }
    }
    return;
  }

  if (role !== "apple") return;
  if (!APPLE_KEYS.has(e.key)) return;
  sendDirection("appleDirection", { x: 0, y: 0 });
});

canvas.addEventListener("click", focusBoard);

joinBtn.addEventListener("click", connect);

modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    setLocalMode(input.value === "local");
    joinBtn.textContent = input.value === "local" ? "Start local game" : "Connect";
  });
});

settingsBtn.addEventListener("click", () => {
  settingsScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");
});

saveSettingsBtn.addEventListener("click", () => {
  applySettings();
  settingsScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  focusBoard();
});

closeSettingsBtn.addEventListener("click", () => {
  settingsScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  focusBoard();
});

openSecondTabBtn.addEventListener("click", () => {
  const otherRole = role && role !== "spectator" ? oppositeRole(role) : "apple";
  const code = lobbyDisplay.textContent && lobbyDisplay.textContent !== "—" ? lobbyDisplay.textContent : lobbyCodeInput.value.trim().toUpperCase();
  const url = `${window.location.origin}${window.location.pathname}?role=${otherRole}&code=${encodeURIComponent(code)}&autoconnect=1`;
  window.open(url, "_blank", "noopener,noreferrer");
});

restartBtn.addEventListener("click", () => {
  if (localMode && localGame) {
    resetLocalGame();
  } else if (socket) {
    socket.emit("restart");
  }
  overlay.classList.add("hidden");
  focusBoard();
});

requestAnimationFrame(function loop() {
  if (lastState) render(lastState);
  requestAnimationFrame(loop);
});

if (pageParams.get("autoconnect") === "1") {
  connect();
}
