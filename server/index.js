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
const wss = new WebSocketServer({ server, path: '/ws', perMessageDeflate: false });
const game = new Game();
const PORT = Number(process.env.PORT || 3000);
const EVENT_SECRET = process.env.TIKTOK_EVENT_SECRET || '';
let connectedTikTokUser = '';
let botMode = false;
const sseClients = new Set();
const BROADCAST_INTERVAL_MS = 100;
let lastBroadcastAt = 0;
let broadcastTimer = null;

app.use(express.json({ limit: '64kb' }));
app.use(express.static(dist));

function frontendState() {
  const s = game.state();
  const players = s.players.map(p => ({ ...p, slotIndex:p.slot, evolutionLevel:p.evolution, lastActivityAt:p.joinedAt, targetAngle:p.angle, nextDirChangeTime:p.nextDirChange, position:{x:p.x,y:p.z,angle:p.angle}, isHitFlashing:false }));
  const playerById = new Map(players.map(p => [p.platformUserId,p]));
  const projectiles = s.projectiles.map(b => ({ ...b, position:{x:b.x,y:b.z}, velocity:{x:b.vx,y:b.vz}, evolutionLevel:b.evolution, isBoosted:b.boosted, createdAt:b.bornAt }));
  const effects = s.effects.map(e => ({ ...e, position:{x:e.position.x,y:e.position.z} }));
  const leaderboard = [...players].sort((a,b)=>b.kills-a.kills||b.hearts-a.hearts||b.damageDealt-a.damageDealt||b.evolutionLevel-a.evolutionLevel);
  const config = { MATCH_DURATION_SEC:240, MAX_PLAYERS:4, START_COUNTDOWN_SEC:5, MAX_HEARTS:5, EVOLUTION_KILL_THRESHOLDS:{LEVEL_1:0,LEVEL_2:3,LEVEL_3:7,LEVEL_4:12}, ATTACK_COOLDOWN_MS:50, HEAL_COOLDOWN_MS:800, HEAL_AMOUNT:1, DAMAGE_BUFF_DURATION_SEC:10, AFK_TIMEOUT_MS:60000, PROJECTILE_SPEED:19, PROJECTILE_RANGE:30, GIFT_MAP:{JOIN_GIFT:'PANDA',ATTACK_GIFT:'ROSE',HEAL_GIFT:'DONUT',EVOLVE_GIFT:'TOPI_KUMIS',DAMAGE_BUFF_GIFT:'PETIR',REVIVE_GIFT:'DRAGON',SPECIAL_GIFT:'SPECIAL'}, AUTO_BOT_MODE:botMode };
  return { matchId:s.matchId, state:s.phase, timerSec:Math.floor(s.remaining), theme:s.theme.id, players, projectiles, effects, leaderboard, globalLeaderboard:s.globalLeaderboard, feed:s.feed, winner:s.winner?playerById.get(s.winner.platformUserId)||null:undefined, config, connectedTikTokUser:connectedTikTokUser||undefined, isTikTokConnected:Boolean(connectedTikTokUser), lastUpdate:Date.now(), maxPlayers:4, maxHearts:5, phase:s.phase, remaining:s.remaining, countdown:s.countdown, currentLeaderboard:s.currentLeaderboard };
}

app.get('/api/status', (_,res)=>{res.set('Cache-Control','no-store,no-cache,must-revalidate,proxy-revalidate');res.json(frontendState());});
function firstPlayerId(payload={}){return payload.userId||payload.platformUserId||game.players.keys().next().value;}
function performAction(action,payload={}){
  const normalized=String(action||'').trim().toUpperCase();
  if(normalized==='JOIN'){const id=payload.userId||payload.platformUserId||`dev-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;return game.addPlayer(id,payload.username||`Viewer_${Math.floor(Math.random()*90+10)}`,payload.avatarUrl||'');}
  const id=firstPlayerId(payload);
  switch(normalized){case'ATTACK':return{ok:game.attack(id,payload.quantity||1)};case'SPAM_ATTACK':return{ok:game.attack(id,5)};case'HEAL':return{ok:game.heal(id)};case'DAMAGE_BUFF':return{ok:game.damageBuff(id)};case'EVOLVE_MANUAL':return{ok:game.manualEvolve(id)};case'SPECIAL':return{ok:game.special(id)};case'REVIVE':return{ok:game.revive(id)};case'RESET_MATCH':game.resetMatch();return{ok:true};case'SIMULATE_4_JOIN':{const joined=[];for(let i=0;i<4;i++){if(game.players.size>=4)break;const result=performAction('JOIN',{username:`Viewer_${i+1}`});if(result.ok)joined.push(result.player);}return{ok:joined.length>0,players:joined};}default:return{ok:false,reason:'UNKNOWN_ACTION'};}
}
function sendAction(req,res,action,payload={}){const result=performAction(action,payload);res.set('Cache-Control','no-store');res.json({...result,state:frontendState()});}
app.post('/api/dev/event',(req,res)=>sendAction(req,res,req.body?.action,req.body?.payload||{}));
app.post('/api/dev/join',(req,res)=>sendAction(req,res,'JOIN',req.body||{}));
app.post('/api/dev/attack',(req,res)=>sendAction(req,res,'ATTACK',req.body||{}));
app.post('/api/dev/heal',(req,res)=>sendAction(req,res,'HEAL',req.body||{}));
app.post('/api/dev/buff',(req,res)=>sendAction(req,res,'DAMAGE_BUFF',req.body||{}));
app.post('/api/dev/evolve',(req,res)=>sendAction(req,res,'EVOLVE_MANUAL',req.body||{}));
app.post('/api/dev/special',(req,res)=>sendAction(req,res,'SPECIAL',req.body||{}));
app.post('/api/dev/revive',(req,res)=>sendAction(req,res,'REVIVE',req.body||{}));
app.post('/api/dev/reset',(_,res)=>sendAction(_,res,'RESET_MATCH'));
app.post('/api/dev/bot',(req,res)=>{botMode=Boolean(req.body?.enable);res.json({ok:true,state:frontendState()});});
app.post('/api/tiktok/connect',(req,res)=>{connectedTikTokUser=String(req.body?.username||'').trim();res.json({ok:true,state:frontendState()});});
app.get('/api/events',(req,res)=>{res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache,no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(`data: ${JSON.stringify({type:'GAME_STATE',data:frontendState()})}\n\n`);sseClients.add(res);req.on('close',()=>sseClients.delete(res));});
app.post('/api/events/tiktok',(req,res)=>{if(EVENT_SECRET&&req.get('x-event-secret')!==EVENT_SECRET)return res.status(401).json({ok:false,error:'UNAUTHORIZED'});const e=req.body||{};if(!e.type||!e.platformUserId)return res.status(400).json({ok:false,error:'INVALID_EVENT'});game.queueEvent(e);res.json({ok:true});});
app.get('/leaderboard',(_,res)=>res.sendFile(path.join(dist,'index.html')));
app.get('/arena',(_,res)=>res.sendFile(path.join(dist,'index.html')));
app.use((req,res,next)=>{if(req.path.startsWith('/api/')||req.path==='/ws')return next();res.sendFile(path.join(dist,'index.html'));});

function broadcast(){
  const data=frontendState();
  const wsMessage=JSON.stringify({type:'GAME_STATE',data});
  for(const ws of wss.clients){if(ws.readyState!==1)continue;if(ws.bufferedAmount>1024*1024){try{ws.terminate();}catch{}continue;}ws.send(wsMessage);}
  const sseMessage=`data: ${JSON.stringify({type:'GAME_STATE',data})}\n\n`;
  for(const client of sseClients){try{if(client.writableEnded||client.destroyed){sseClients.delete(client);continue;}client.write(sseMessage);}catch{sseClients.delete(client);}}
}
function scheduleBroadcast(){
  if(broadcastTimer)return;
  const wait=Math.max(0,BROADCAST_INTERVAL_MS-(Date.now()-lastBroadcastAt));
  broadcastTimer=setTimeout(()=>{broadcastTimer=null;lastBroadcastAt=Date.now();broadcast();},wait);
}

wss.on('connection',ws=>{ws.send(JSON.stringify({type:'GAME_STATE',data:frontendState()}));});
game.subscribe(()=>scheduleBroadcast());
setInterval(()=>game.tick(1/30),1000/30);
server.listen(PORT,'0.0.0.0',()=>console.log(`Node-Battle running: http://localhost:${PORT}`));
