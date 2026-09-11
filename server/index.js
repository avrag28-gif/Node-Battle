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
const EVENT_SECRET = process.env.TIKTOK_EVENT_SECRET || '';

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(root, 'public')));

app.get('/api/status', (_, res) => res.json(game.state()));
app.post('/api/dev/join', (req, res) => res.json(game.addPlayer(req.body.userId || `dev-${Date.now()}`, req.body.username || 'Viewer', req.body.avatarUrl || '')));
app.post('/api/dev/attack', (req, res) => res.json({ ok: game.attack(req.body.attackerId, req.body.quantity || 1) }));
app.post('/api/dev/heal', (req, res) => res.json({ ok: game.heal(req.body.userId) }));
app.post('/api/dev/buff', (req, res) => res.json({ ok: game.damageBuff(req.body.userId) }));
app.post('/api/dev/evolve', (req, res) => res.json({ ok: game.manualEvolve(req.body.userId) }));
app.post('/api/dev/special', (req, res) => res.json({ ok: game.special(req.body.userId) }));
app.post('/api/dev/revive', (req, res) => res.json({ ok: game.revive(req.body.userId) }));
app.post('/api/dev/reset', (_, res) => { game.resetMatch(); res.json({ ok: true }); });

// Platform-neutral TikTok event bridge. Keep TikTok credentials outside the browser.
app.post('/api/events/tiktok', (req, res) => {
  if (EVENT_SECRET && req.get('x-event-secret') !== EVENT_SECRET) return res.status(401).json({ ok:false, error:'UNAUTHORIZED' });
  const e = req.body || {};
  if (!e.type || !e.platformUserId) return res.status(400).json({ ok:false, error:'INVALID_EVENT' });
  game.queueEvent(e);
  res.json({ ok:true });
});

app.get('/leaderboard', (_, res) => res.sendFile(path.join(root, 'public', 'leaderboard.html')));
app.get('/arena', (_, res) => res.sendFile(path.join(root, 'public', 'index.html')));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/ws') return next();
  res.sendFile(path.join(root, 'public', 'index.html'));
});

wss.on('connection', ws => ws.send(JSON.stringify({ type:'STATE', data:game.state() })));
game.subscribe(state => {
  const message = JSON.stringify({ type:'STATE', data:state });
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(message);
});
setInterval(() => game.tick(1/30), 1000/30);

server.listen(PORT, '0.0.0.0', () => console.log(`Node-Battle running: http://localhost:${PORT}`));
