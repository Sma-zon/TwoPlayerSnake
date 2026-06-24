# TwoPlayerSnake

One person plays as the **snake**, the other as the **apple** — from separate computers over the network.

## How it works

- The **snake** grows each time it catches the apple. The apple respawns at a random empty spot.
- The **apple** can move around the board (slower than the snake so it stays catchable).
- If the snake hits a wall or itself, the apple wins that round.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server on one machine (the host):

   ```bash
   npm start
   ```

3. Both players open a browser:
   - **Host (snake):** `http://localhost:3000`
   - **Other player (apple):** `http://<host-ip>:3000` (replace with the host's local IP, e.g. `http://192.168.1.5:3000`)

4. Each player picks their role and clicks **Connect**. The game starts when both are connected.

## Controls

| Role  | Keys                          |
|-------|-------------------------------|
| Snake | WASD or arrow keys            |
| Apple | IJKL or arrow keys (hold to move, release to stop) |

## Notes

- Both players must be on the same network (or the host must port-forward `3000`).
- If a player disconnects, the game pauses until they reconnect and both roles are filled again.
