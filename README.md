# Node-Battle

Standalone TikTok Live tank-battle runtime.

## Pages
- `/` — arena only. Designed as the clean game canvas output for OBS/Virtual Camera.
- `/leaderboard.html` — separate leaderboard page: current match first, global leaderboard below.

## Runtime
Node.js backend + WebSocket authoritative game state + Three.js arena renderer.

The backend is intentionally JavaScript, not TypeScript. The arena client is also JavaScript. Platform/TikTok integration should feed the game through the server event layer; no TikTok credentials belong in the browser.

## Start
PowerShell:

```powershell
npm install; npm run live
```

Or after dependencies are installed:

```powershell
npm run live
```

Open `http://localhost:3000/` for the clean arena and `http://localhost:3000/leaderboard.html` for the leaderboard.

## Dev API
- `POST /api/dev/join` `{ "userId": "u1", "username": "Viewer" }`
- `POST /api/dev/attack` `{ "attackerId": "u1", "targetId": "u2" }`
- `POST /api/dev/heal` `{ "userId": "u1" }`
- `POST /api/dev/reset` `{}`

## Important
The current implementation is the new clean runtime foundation, not a claim that the existing Battle-Tank prototype's visual assets have been copied. The original prototype was inspected: it currently uses React/Vite, Three.js, Express and `ws`, while its server-side game engine contains the combat, theme, evolution and leaderboard concepts. fileciteturn7file0L2-L7
