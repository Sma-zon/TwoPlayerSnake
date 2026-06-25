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

   If port `3000` is already in use, start on a different port:

   ```bash
   set PORT=3002&& npm start
   ```

3. Both players open a browser and connect to the host address.
   - If this machine is the host, open `http://localhost:3000`
   - On the other computer, open `http://<host-ip>:3000` (replace with the host's local IP, e.g. `http://192.168.1.5:3000`)

4. To create a lobby, leave the lobby code blank and click **Connect**. The host receives a generated 4-character lobby code.

5. The other player enters that lobby code in the join screen, chooses a role, and clicks **Connect**.

6. The game starts when both the snake and apple are connected.

## Controls

| Role  | Keys                          |
|-------|-------------------------------|
| Snake | WASD or arrow keys            |
| Apple | IJKL or arrow keys (hold to move, release to stop) |

## Notes

- Both players must be on the same network (or the host must port-forward `3000`).
- If a player disconnects, the game pauses until they reconnect and both roles are filled again.
