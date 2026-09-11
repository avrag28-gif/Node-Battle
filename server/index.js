import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Game } from './game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const game = new Game();
const PORT = Number(process.env.PORT || 3000);
const EVENT_SECRET = process.env.TIKTOK_EVENT_SECRET || '';
let connectedTikTokUser = '';
let botMode = false;
const sseClients = new Set();

app.use(express.json({ limit: '64kb' }));
app.use(express.static(dist));

function frontendState() {
  const s = game.state();
  const players = s.players.map(p => ({
    ...p,
    slotIndex: p.slot,
    evolutionLevel: p.evolution,
    lastActivityAt: p.joinedAt,
    targetAngle: p.angle,
    nextDirChangeTime: p.nextDirChange,
    position: { x: p.x, y: p.z, angle: p.angle },
    isHitFlashing: false,
  }));
  const playerById = new Map(players.map(p => [p.platformUserId, p]));
  const projectiles = s.projectiles.map(b => ({
    ...b,
    position: { x: b.x, y: b.z },
    velocity: { x: b.vx, y: b.vz },
    evolutionLevel: b.evolution,
    isBoosted: b.boosted,
    createdAt: b.bornAt,
  }));
  const effects = s.effects.map(e => ({
    ...e,
    position: { x: e.position.x, y: e.position.z },
  }));
  const leaderboard = [...players].sort((a,b) => b.kills-a.kills || b.hearts-a.hearts || b.damageDealt-a.damageDealt || b.evolutionLevel-a.evolutionLevel);
  const config = {
    MATCH_DURATION_SEC: 240,
    MAX_PLAYERS: 4,
    START_COUNTDOWN_SEC: 5,
    MAX_HEARTS: 5,
    EVOLUTION_KILL_THRESHOLDS: { LEVEL_1: 0, LEVEL_2: 3, LEVEL_3: 7, LEVEL_4: 12 },
    ATTACK_COOLDOWN_MS: 50,
    HEAL_COOLDOWN_MS: 800,
    HEAL_AMOUNT: 1,
    DAMAGE_BUFF_DURATION_SEC: 10,
    AFK_TIMEOUT_MS: 60000,
    PROJECTILE_SPEED: 19,
    PROJECTILE_RANGE: 30,
    GIFT_MAP: {
      JOIN_GIFT: 'PANDA', ATTACK_GIFT: 'ROSE', HEAL_GIFT: 'DONUT',
      EVOLVE_GIFT: 'TOPI_KUMIS', DAMAGE_BUFF_GIFT: 'PETIR', REVIVE_GIFT: 'DRAGON', SPECIAL_GIFT: 'SPECIAL'
    },
    AUTO_BOT_MODE: botMode,
  };
  return {
    matchId: s.matchId,
    state: s.phase,
    timerSec: Math.floor(s.remaining),
    theme: s.theme.id,
    players,
    projectiles,
    effects,
    leaderboard,
    globalLeaderboard: s.globalLeaderboard,
    feed: s.feed,
    winner: s.winner ? playerById.get(s.winner.platformUserId) || null : undefined,
    config,
    connectedTikTokUser: connectedTikTokUser || undefined,
    isTikTokConnected: Boolean(connectedTikTokUser),
    lastUpdate: Date.now(),
    maxPlayers: 4,
    maxHearts: 5,
    phase: s.phase,
    remaining: s.remaining,
    countdown: s.countdown,
    currentLeaderboard: s.currentLeaderboard,
  };
}

app.get('/api/status', (_, res) => res.json(frontendState()));

function firstPlayerId(payload = {}) {
  return payload.userId || payload.platformUserId || game.players.keys().next().value;
}

function performAction(action, payload = {}) {
  const id = firstPlayerId(payload);
  switch (String(action).toUpperCase()) {
    case 'JOIN': return game.addPlayer(id || `dev-${Date.now()}`, payload.username || 'Viewer', payload.avatarUrl || '');
    case 'ATTACK': return { ok: game.attack(id, payload.quantity || 1) };
    case 'SPAM_ATTACK': return { ok: game.attack(id, 5) };
    case 'HEAL': return { ok: game.heal(id) };
    case 'DAMAGE_BUFF': return { ok: game.damageBuff(id) };
    case 'EVOLVE_MANUAL': return { ok: game.manualEvolve(id) };
    case 'SPECIAL': return { ok: game.special(id) };
    case 'REVIVE': return { ok: game.revive(id) };
    case 'RESET_MATCH': game.resetMatch(); return { ok: true };
    default: return { ok: false, reason: 'UNKNOWN_ACTION' };
  }
}

app.post('/api/dev/event', (req, res) => res.json({ ...performAction(req.body?.action, req.body?.payload || {}), state: frontendState() }));
app.post('/api/dev/join', (req, res) => res.json({ ...performAction('JOIN', req.body || {}), state: frontendState() }));
app.post('/api/dev/attack', (req, res) => res.json({ ...performAction('ATTACK', req.body || {}), state: frontendState() }));
app.post('/api/dev/heal', (req, res) => res.json({ ...performAction('HEAL', req.body || {}), state: frontendState() }));
app.post('/api/dev/buff', (req, res) => res.json({ ...performAction('DAMAGE_BUFF', req.body || {}), state: frontendState() }));
app.post('/api/dev/evolve', (req, res) => res.json({ ...performAction('EVOLVE_MANUAL', req.body || {}), state: frontendState() }));
app.post('/api/dev/special', (req, res) => res.json({ ...performAction('SPECIAL', req.body || {}), state: frontendState() }));
app.post('/api/dev/revive', (req, res) => res.json({ ...performAction('REVIVE', req.body || {}), state: frontendState() }));
app.post('/api/dev/reset', (_, res) => res.json({ ...performAction('RESET_MATCH'), state: frontendState() }));
app.post('/api/dev/bot', (req, res) => { botMode = Boolean(req.body?.enable); res.json({ ok: true, state: frontendState() }); });
app.post('/api/tiktok/connect', (req, res) => { connectedTikTokUser = String(req.body?.username || '').trim(); res.json({ ok: true, state: frontendState() }); });

app.get('/api/events', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(`data: ${JSON.stringify({ type: 'GAME_STATE', data: frontendState() })}\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// Platform-neutral TikTok event bridge. Keep TikTok credentials outside the browser.
app.post('/api/events/tiktok', (req, res) => {
  if (EVENT_SECRET && req.get('x-event-secret') !== EVENT_SECRET) return res.status(401).json({ ok:false, error:'UNAUTHORIZED' });
  const e = req.body || {};
  if (!e.type || !e.platformUserId) return res.status(400).json({ ok:false, error:'INVALID_EVENT' });
  game.queueEvent(e);
  res.json({ ok:true });
});

app.get('/leaderboard', (_, res) => res.sendFile(path.join(dist, 'index.html')));
app.get('/arena', (_, res) => res.sendFile(path.join(dist, 'index.html')));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/ws') return next();
  res.sendFile(path.join(dist, 'index.html'));
});

function broadcast() {
  const data = frontendState();
  const wsMessage = JSON.stringify({ type: 'GAME_STATE', data });
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(wsMessage);
  const sseMessage = `data: ${JSON.stringify({ type: 'GAME_STATE', data })}\n\n`;
  for (const client of sseClients) client.write(sseMessage);
}

wss.on('connection', ws => ws.send(JSON.stringify({ type:'GAME_STATE', data:frontendState() })));
game.subscribe(() => broadcast());
setInterval(() => game.tick(1/30), 1000/30);

server.listen(PORT, '0.0.0.0', () => console.log(`Node-Battle running: http://localhost:${PORT}`));
