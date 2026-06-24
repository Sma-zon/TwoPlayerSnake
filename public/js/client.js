const joinScreen = document.getElementById("join-screen");
const gameScreen = document.getElementById("game-screen");
const serverUrlInput = document.getElementById("server-url");
const joinBtn = document.getElementById("join-btn");
const joinError = document.getElementById("join-error");
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const roleBadge = document.getElementById("role-badge");
const scoreEl = document.getElementById("score");
const snakeStatus = document.getElementById("snake-status");
const appleStatus = document.getElementById("apple-status");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const restartBtn = document.getElementById("restart-btn");
const controlsHint = document.getElementById("controls-hint");

let socket = null;
let role = null;
let lastState = null;
let cellSize = 20;

serverUrlInput.value = window.location.origin;

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
  i: { x: 0, y: -1 },
  k: { x: 0, y: 1 },
  j: { x: -1, y: 0 },
  l: { x: 1, y: 0 },
  I: { x: 0, y: -1 },
  K: { x: 0, y: 1 },
  J: { x: -1, y: 0 },
  L: { x: 1, y: 0 },
};

const SNAKE_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"]);
const APPLE_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "i", "j", "k", "l", "I", "J", "K", "L"]);

function showError(message) {
  joinError.textContent = message;
  joinError.classList.remove("hidden");
}

function hideError() {
  joinError.classList.add("hidden");
}

function connect() {
  hideError();
  const url = serverUrlInput.value.trim() || window.location.origin;
  const requestedRole = document.querySelector('input[name="role"]:checked').value;

  joinBtn.disabled = true;
  joinBtn.textContent = "Connecting…";

  socket = io(url, {
    query: { role: requestedRole },
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    joinScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    joinBtn.disabled = false;
    joinBtn.textContent = "Connect";
  });

  socket.on("connect_error", (err) => {
    showError(`Could not connect: ${err.message}`);
    joinBtn.disabled = false;
    joinBtn.textContent = "Connect";
    socket = null;
  });

  socket.on("assigned", ({ role: assignedRole }) => {
    role = assignedRole;
    roleBadge.textContent = assignedRole;
    roleBadge.className = `badge ${assignedRole}`;

    if (assignedRole === "snake") {
      controlsHint.textContent = "Use WASD or arrow keys to steer the snake.";
    } else if (assignedRole === "apple") {
      controlsHint.textContent = "Use IJKL or arrow keys to move the apple. Stay ahead of the snake!";
    } else {
      controlsHint.textContent = "Both roles are taken — you are spectating.";
    }
  });

  socket.on("lobby", ({ snakeConnected, appleConnected }) => {
    snakeStatus.className = `dot ${snakeConnected ? "online" : "offline"}`;
    appleStatus.className = `dot ${appleConnected ? "online" : "offline"}`;
  });

  socket.on("state", (state) => {
    lastState = state;
    render(state);
  });

  socket.on("disconnect", () => {
    overlayText.textContent = "Disconnected from server.";
    overlay.classList.remove("hidden");
  });
}

function render(state) {
  cellSize = canvas.width / state.gridWidth;

  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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

  state.snake.forEach((segment, i) => {
    const padding = i === 0 ? 1 : 2;
    ctx.fillStyle = i === 0 ? "#4ade80" : "#22c55e";
    ctx.fillRect(
      segment.x * cellSize + padding,
      segment.y * cellSize + padding,
      cellSize - padding * 2,
      cellSize - padding * 2
    );
  });

  const applePadding = 3;
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(
    state.apple.x * cellSize + cellSize / 2,
    state.apple.y * cellSize + cellSize / 2,
    cellSize / 2 - applePadding,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "#166534";
  ctx.fillRect(
    state.apple.x * cellSize + cellSize / 2 - 1,
    state.apple.y * cellSize + applePadding,
    2,
    applePadding + 2
  );

  scoreEl.textContent = state.score;

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
  if (!socket || !socket.connected) return;
  socket.emit(eventName, dir);
}

document.addEventListener("keydown", (e) => {
  const dir = KEY_TO_DIR[e.key];
  if (!dir) return;

  if (role === "snake" && SNAKE_KEYS.has(e.key)) {
    e.preventDefault();
    sendDirection("snakeDirection", dir);
  } else if (role === "apple" && APPLE_KEYS.has(e.key)) {
    e.preventDefault();
    sendDirection("appleDirection", dir);
  }
});

document.addEventListener("keyup", (e) => {
  if (role !== "apple") return;
  if (!APPLE_KEYS.has(e.key)) return;
  sendDirection("appleDirection", { x: 0, y: 0 });
});

joinBtn.addEventListener("click", connect);

restartBtn.addEventListener("click", () => {
  if (socket) socket.emit("restart");
  overlay.classList.add("hidden");
});

requestAnimationFrame(function loop() {
  if (lastState) render(lastState);
  requestAnimationFrame(loop);
});
