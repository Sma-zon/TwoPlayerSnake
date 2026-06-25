const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { Game } = require("./game");

const PORT = process.env.PORT || 3000;
const SNAKE_TICK_MS = 130;
const APPLE_TICK_MS = 210;
const LOBBY_CODE_LENGTH = 4;
const LOBBY_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "..", "public")));

const lobbies = new Map();

function buildLobbyCode() {
  let code = "";
  for (let i = 0; i < LOBBY_CODE_LENGTH; i += 1) {
    code += LOBBY_CODE_CHARS[Math.floor(Math.random() * LOBBY_CODE_CHARS.length)];
  }
  return code;
}

function normalizeLobbyCode(value) {
  if (!value) return "";
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, LOBBY_CODE_LENGTH);
}

function createLobby(code) {
  const lobbyCode = code || buildLobbyCode();
  const lobby = {
    code: lobbyCode,
    game: new Game(),
    snakeSocketId: null,
    appleSocketId: null,
    snakeInterval: null,
    appleInterval: null,
  };
  lobbies.set(lobbyCode, lobby);
  return lobby;
}

function getLobby(code) {
  if (!code) return null;
  return lobbies.get(normalizeLobbyCode(code)) || null;
}

function getOrCreateLobby(code) {
  if (!code) {
    let lobby;
    do {
      lobby = createLobby();
    } while (lobbies.has(lobby.code) && lobby.code);
    return lobby;
  }

  const normalized = normalizeLobbyCode(code);
  return lobbies.get(normalized) || null;
}

function pruneSocketRole(lobby, socket) {
  if (!lobby) return;
  if (socket.id === lobby.snakeSocketId) lobby.snakeSocketId = null;
  if (socket.id === lobby.appleSocketId) lobby.appleSocketId = null;
}

function assignRole(lobby, socket, requestedRole) {
  if (requestedRole === "snake" && !lobby.snakeSocketId) {
    lobby.snakeSocketId = socket.id;
    return "snake";
  }
  if (requestedRole === "apple" && !lobby.appleSocketId) {
    lobby.appleSocketId = socket.id;
    return "apple";
  }
  if (!lobby.snakeSocketId) {
    lobby.snakeSocketId = socket.id;
    return "snake";
  }
  if (!lobby.appleSocketId) {
    lobby.appleSocketId = socket.id;
    return "apple";
  }
  return "spectator";
}

function getWaitingFor(lobby) {
  if (lobby.snakeSocketId && !lobby.appleSocketId) return "apple";
  if (lobby.appleSocketId && !lobby.snakeSocketId) return "snake";
  return null;
}

function broadcastLobby(lobby) {
  const payload = {
    code: lobby.code,
    snakeConnected: Boolean(lobby.snakeSocketId),
    appleConnected: Boolean(lobby.appleSocketId),
    gameRunning: Boolean(lobby.snakeInterval),
    waitingFor: getWaitingFor(lobby),
  };
  console.log("broadcastLobby", payload);
  io.to(lobby.code).emit("lobby", payload);
}

function broadcastState(lobby) {
  io.to(lobby.code).emit("state", {
    ...lobby.game.getState(),
    gameRunning: Boolean(lobby.snakeInterval),
  });
}

function startGameLoop(lobby) {
  if (lobby.snakeInterval) return;

  lobby.game.reset();

  lobby.snakeInterval = setInterval(() => {
    lobby.game.tickSnake();
    broadcastState(lobby);
  }, SNAKE_TICK_MS);

  lobby.appleInterval = setInterval(() => {
    lobby.game.tickApple();
    broadcastState(lobby);
  }, APPLE_TICK_MS);
}

function stopGameLoop(lobby) {
  if (lobby.snakeInterval) clearInterval(lobby.snakeInterval);
  if (lobby.appleInterval) clearInterval(lobby.appleInterval);
  lobby.snakeInterval = null;
  lobby.appleInterval = null;
}

function cleanupLobby(lobby) {
  const room = io.sockets.adapter.rooms.get(lobby.code);
  if (!room || room.size === 0) {
    lobbies.delete(lobby.code);
  }
}

io.on("connection", (socket) => {
  const requestedRole = socket.handshake.query.role;
  const rawCode = String(socket.handshake.query.code || "").trim();
  const requestedCode = rawCode ? normalizeLobbyCode(rawCode) : "";
  const lobby = rawCode ? getLobby(requestedCode) : createLobby();

  console.log("socket connect", {
    id: socket.id,
    role: requestedRole,
    rawCode,
    requestedCode,
    lobbyCode: lobby?.code,
  });

  if (rawCode && (!requestedCode || requestedCode.length !== LOBBY_CODE_LENGTH || !lobby)) {
    socket.emit("lobbyError", {
      message: "Lobby not found. Please check the code and try again.",
    });
    socket.disconnect(true);
    return;
  }

  socket.lobbyCode = lobby.code;
  socket.join(lobby.code);

  const role = assignRole(lobby, socket, requestedRole);
  socket.emit("assigned", { role });
  if (!requestedCode) {
    socket.emit("lobbyCreated", { code: lobby.code });
  }

  broadcastLobby(lobby);
  broadcastState(lobby);

  if (lobby.snakeSocketId && lobby.appleSocketId) {
    startGameLoop(lobby);
  }

  socket.on("snakeDirection", (dir) => {
    if (socket.id !== lobby.snakeSocketId) return;
    if (!dir || typeof dir.x !== "number" || typeof dir.y !== "number") return;
    lobby.game.setSnakeDirection(dir);
  });

  socket.on("appleDirection", (dir) => {
    if (socket.id !== lobby.appleSocketId) return;
    if (!dir || typeof dir.x !== "number" || typeof dir.y !== "number") return;
    lobby.game.setAppleDirection(dir);
  });

  socket.on("restart", () => {
    if (socket.id !== lobby.snakeSocketId && socket.id !== lobby.appleSocketId) return;
    if (!lobby.snakeSocketId || !lobby.appleSocketId) return;
    lobby.game.reset();
    broadcastState(lobby);
  });

  socket.on("disconnect", () => {
    pruneSocketRole(lobby, socket);
    stopGameLoop(lobby);
    broadcastLobby(lobby);
    broadcastState(lobby);
    cleanupLobby(lobby);
  });
});

server.listen(PORT, () => {
  console.log(`TwoPlayerSnake running at http://localhost:${PORT}`);
  console.log("Share your local IP so the other player can connect from another computer.");
});
