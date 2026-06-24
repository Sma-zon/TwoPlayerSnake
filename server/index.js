const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { Game } = require("./game");

const PORT = process.env.PORT || 3000;
const SNAKE_TICK_MS = 130;
const APPLE_TICK_MS = 210;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "..", "public")));

const game = new Game();
let snakeSocketId = null;
let appleSocketId = null;
let snakeInterval = null;
let appleInterval = null;

function broadcastState() {
  io.emit("state", game.getState());
}

function broadcastLobby() {
  io.emit("lobby", {
    snakeConnected: Boolean(snakeSocketId),
    appleConnected: Boolean(appleSocketId),
    gameRunning: Boolean(snakeInterval),
  });
}

function startGameLoop() {
  if (snakeInterval) return;

  game.reset();

  snakeInterval = setInterval(() => {
    game.tickSnake();
    broadcastState();
  }, SNAKE_TICK_MS);

  appleInterval = setInterval(() => {
    game.tickApple();
    broadcastState();
  }, APPLE_TICK_MS);
}

function stopGameLoop() {
  if (snakeInterval) clearInterval(snakeInterval);
  if (appleInterval) clearInterval(appleInterval);
  snakeInterval = null;
  appleInterval = null;
}

function assignRole(socket, requestedRole) {
  if (requestedRole === "snake" && !snakeSocketId) {
    snakeSocketId = socket.id;
    return "snake";
  }
  if (requestedRole === "apple" && !appleSocketId) {
    appleSocketId = socket.id;
    return "apple";
  }
  if (!snakeSocketId) {
    snakeSocketId = socket.id;
    return "snake";
  }
  if (!appleSocketId) {
    appleSocketId = socket.id;
    return "apple";
  }
  return "spectator";
}

io.on("connection", (socket) => {
  const role = assignRole(socket, socket.handshake.query.role);
  socket.emit("assigned", { role });
  broadcastLobby();
  broadcastState();

  if (snakeSocketId && appleSocketId) {
    startGameLoop();
  }

  socket.on("snakeDirection", (dir) => {
    if (socket.id !== snakeSocketId) return;
    if (!dir || typeof dir.x !== "number" || typeof dir.y !== "number") return;
    game.setSnakeDirection(dir);
  });

  socket.on("appleDirection", (dir) => {
    if (socket.id !== appleSocketId) return;
    if (!dir || typeof dir.x !== "number" || typeof dir.y !== "number") return;
    game.setAppleDirection(dir);
  });

  socket.on("restart", () => {
    if (socket.id !== snakeSocketId && socket.id !== appleSocketId) return;
    if (!snakeSocketId || !appleSocketId) return;
    game.reset();
    broadcastState();
  });

  socket.on("disconnect", () => {
    if (socket.id === snakeSocketId) snakeSocketId = null;
    if (socket.id === appleSocketId) appleSocketId = null;
    stopGameLoop();
    broadcastLobby();
    broadcastState();
  });
});

server.listen(PORT, () => {
  console.log(`TwoPlayerSnake running at http://localhost:${PORT}`);
  console.log("Share your local IP so the other player can connect from another computer.");
});
