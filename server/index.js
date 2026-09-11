import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Game } from './game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const game = new Game();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(root, 'public')));

app.get('/api/status', (_, res) => res.json(game.state()));
app.post('/api/dev/join', (req, res) => res.json(game.addPlayer(req.body.userId || `dev-${Date.now()}`, req.body.username || 'Viewer')));
app.post('/api/dev/attack', (req, res) => res.json({ ok: game.attack(req.body.attackerId, req.body.targetId) }));
app.post('/api/dev/heal', (req, res) => res.json({ ok: game.heal(req.body.userId) }));
app.post('/api/dev/reset', (_, res) => { game.resetMatch(); res.json({ ok: true }); });
app.get('*', (_, res) => res.sendFile(path.join(root, 'public', 'index.html')));

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'STATE', data: game.state() }));
});
game.subscribe(state => {
  const message = JSON.stringify({ type: 'STATE', data: state });
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(message);
});
setInterval(() => game.tick(), 250);

server.listen(PORT, '0.0.0.0', () => console.log(`Node-Battle running: http://localhost:${PORT}`));
