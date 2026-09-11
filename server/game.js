const THEMES = [
  { id: 'DESERT', name: 'Gobi Desert Battlefield', accent: '#ff8c00' },
  { id: 'FROZEN_ICE', name: 'Glacial Ice Outpost', accent: '#00f2fe' },
  { id: 'VOLCANIC', name: 'Alien Obsidian Arena', accent: '#ff2e63' }
];

const MAX_PLAYERS = 5;
const MAX_HEARTS = 5;
const MATCH_SECONDS = 240;
const COUNTDOWN_SECONDS = 5;
const MATCH_END_SECONDS = 5;
const RESULT_SECONDS = 8;
const EVOLUTION_KILLS = [3, 7, 12];
const ATTACK_COOLDOWN_MS = 50;
const HEAL_COOLDOWN_MS = 800;
const PROJECTILE_SPEED = 19;
const DAMAGE_BUFF_SECONDS = 10;

const SLOT_POSITIONS = [
  { x: -4.2, z: 4.2, angle: 135 },
  { x: 4.2, z: -4.2, angle: -45 },
  { x: -4.2, z: -4.2, angle: 45 },
  { x: 4.2, z: 4.2, angle: -135 },
  { x: 0, z: 6.8, angle: 180 }
];

const SLOT_COLORS = ['#FF2D55', '#00FF66', '#00E5FF', '#FF9900', '#B56CFF'];

const EVOLUTIONS = {
  1: { title: 'BASE TANK', scale: 1, barrels: 1, bonus: '#ffffff' },
  2: { title: 'DUAL HEAVY DESTROYER', scale: 1.25, barrels: 2, bonus: '#ffd700' },
  3: { title: 'TRIPLE LASER RAILGUN', scale: 1.45, barrels: 3, bonus: '#00ffff' },
  4: { title: 'QUAD TITAN MECH', scale: 1.7, barrels: 4, bonus: '#ff007f' }
};

export class Game {
  constructor() {
    this.players = new Map();
    this.globalStats = new Map();
    this.projectiles = [];
    this.effects = [];
    this.feed = [];
    this.queue = [];
    this.listeners = new Set();
    this.themeIndex = -1;
    this.phase = 'WAITING';
    this.remaining = 0;
    this.countdown = COUNTDOWN_SECONDS;
    this.winner = null;
    this.resetMatch();
  }

  subscribe(fn) { this.listeners.add(fn); fn(this.state()); return () => this.listeners.delete(fn); }
  emit() { const s = this.state(); for (const fn of this.listeners) fn(s); }

  nextTheme() {
    let n = Math.floor(Math.random() * THEMES.length);
    if (n === this.themeIndex) n = (n + 1) % THEMES.length;
    this.themeIndex = n;
    return THEMES[n];
  }

  addFeed(type, message, username = '', color = '#fbbf24') {
    this.feed.push({ id: `${Date.now()}-${Math.random()}`, type, message, username, color, createdAt: Date.now() });
    if (this.feed.length > 20) this.feed.shift();
  }

  addEffect(type, p, color, text = '', durationMs = 1200) {
    this.effects.push({ id: `${Date.now()}-${Math.random()}`, type, position: { x: p.x, z: p.z }, color, text, createdAt: Date.now(), durationMs });
  }

  resetMatch() {
    this.players.clear();
    this.projectiles = [];
    this.effects = [];
    this.feed = [];
    this.queue = [];
    this.winner = null;
    this.phase = 'WAITING';
    this.remaining = 0;
    this.countdown = COUNTDOWN_SECONDS;
    this.matchId = `MATCH_${Date.now()}`;
    this.theme = this.nextTheme();
    this.addFeed('SYSTEM', `🏜️ ARENA READY — ${this.theme.name}`);
    this.addFeed('SYSTEM', '⏳ Kirim 🐼 Panda untuk masuk arena (maks 5 tank).');
    this.emit();
  }

  ensureGlobal(p) {
    if (!this.globalStats.has(p.platformUserId)) {
      this.globalStats.set(p.platformUserId, {
        platformUserId: p.platformUserId,
        username: p.username,
        avatarUrl: p.avatarUrl,
        totalKills: 0,
        totalMatches: 0,
        totalWins: 0,
        totalDamage: 0,
        highestEvolution: 1,
        lastPlayedAt: Date.now()
      });
    }
    const g = this.globalStats.get(p.platformUserId);
    g.username = p.username;
    if (p.avatarUrl) g.avatarUrl = p.avatarUrl;
    return g;
  }

  addPlayer(platformUserId, username = 'Viewer', avatarUrl = '') {
    if (this.phase === 'MATCH_END' || this.phase === 'RESULT') return { ok: false, reason: 'MATCH_ENDED' };
    if (this.players.has(platformUserId)) return { ok: false, reason: 'ALREADY_IN_MATCH' };
    if (this.players.size >= MAX_PLAYERS) return { ok: false, reason: 'ARENA_FULL' };
    const used = new Set([...this.players.values()].map(p => p.slot));
    const slot = [...Array(MAX_PLAYERS).keys()].find(i => !used.has(i));
    const spawn = SLOT_POSITIONS[slot];
    const p = {
      id: `P-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      platformUserId,
      username: String(username).slice(0, 24),
      avatarUrl,
      slot,
      color: SLOT_COLORS[slot],
      hearts: MAX_HEARTS,
      maxHearts: MAX_HEARTS,
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      score: 0,
      evolution: 1,
      status: 'ALIVE',
      x: spawn.x,
      z: spawn.z,
      angle: spawn.angle,
      rotationSpeed: 38 + Math.floor(Math.random() * 46),
      rotationDir: Math.random() < 0.5 ? 1 : -1,
      nextDirChange: Date.now() + 6000 + Math.random() * 8000,
      damageBoostUntil: 0,
      damageBoostMultiplier: 1,
      lastAttack: 0,
      lastHeal: 0,
      joinedAt: Date.now()
    };
    this.players.set(platformUserId, p);
    this.ensureGlobal(p);
    this.addEffect('SPAWN', p, p.color, 'JOINED!', 1200);
    this.addFeed('PLAYER_JOIN', `🎁 @${p.username} JOINED THE ARENA! (Slot #${slot + 1})`, p.username, p.color);
    if (this.players.size >= 2 && this.phase === 'WAITING') {
      this.phase = 'COUNTDOWN';
      this.countdown = COUNTDOWN_SECONDS;
      this.remaining = COUNTDOWN_SECONDS;
      this.addFeed('SYSTEM', `⏳ BATTLE COUNTDOWN ${COUNTDOWN_SECONDS}s`);
    }
    this.emit();
    return { ok: true, player: p };
  }

  queueEvent(event) { this.queue.push(event); }

  processQueue() {
    if (!this.queue.length) return;
    const priority = t => ['PLAYER_REVIVE', 'PLAYER_SPECIAL'].includes(t) ? 3 : ['PLAYER_JOIN', 'PLAYER_HEAL'].includes(t) ? 2 : 1;
    this.queue.sort((a, b) => priority(b.type) - priority(a.type));
    for (const e of this.queue.splice(0, 10)) {
      switch (e.type) {
        case 'PLAYER_JOIN': this.addPlayer(e.platformUserId, e.username, e.avatarUrl); break;
        case 'PLAYER_ATTACK': this.attack(e.platformUserId, e.quantity || 1); break;
        case 'PLAYER_HEAL': this.heal(e.platformUserId); break;
        case 'PLAYER_DAMAGE_BUFF': this.damageBuff(e.platformUserId); break;
        case 'PLAYER_EVOLVE_MANUAL': this.manualEvolve(e.platformUserId); break;
        case 'PLAYER_SPECIAL': this.special(e.platformUserId); break;
        case 'PLAYER_REVIVE': this.revive(e.platformUserId); break;
        case 'PLAYER_COMMENT': this.addFeed('PLAYER_COMMENT', `💬 ${e.username}: ${e.payload?.comment || ''}`, e.username); break;
        case 'PLAYER_LIKE': this.addFeed('PLAYER_LIKE', `❤️ ${e.username} liked the live stream!`, e.username); break;
      }
    }
  }

  attack(id, quantity = 1) {
    if (this.phase !== 'PLAYING') return false;
    const p = this.players.get(id);
    if (!p || p.status !== 'ALIVE') return false;
    const now = Date.now();
    if (now - p.lastAttack < ATTACK_COOLDOWN_MS) return false;
    p.lastAttack = now;
    const boosted = p.damageBoostUntil > now;
    const damage = boosted ? 2 : 1;
    const repeat = Math.max(1, Math.min(Number(quantity) || 1, 8));
    const base = p.angle * Math.PI / 180;
    const makeProjectile = (rad, offset, delay = 0) => {
      const muzzle = { x: p.x + Math.sin(rad) * (1.5 + offset), z: p.z + Math.cos(rad) * (1.5 + offset) };
      this.projectiles.push({ id: `B-${Date.now()}-${Math.random()}`, ownerId: id, ownerUsername: p.username, ownerColor: p.color, x: muzzle.x, z: muzzle.z, vx: Math.sin(rad) * PROJECTILE_SPEED, vz: Math.cos(rad) * PROJECTILE_SPEED, damage, evolution: p.evolution, boosted, bornAt: now + delay });
      this.addEffect('MUZZLE', muzzle, boosted ? '#ffd000' : p.color, '', 250);
    };
    for (let r = 0; r < repeat; r++) {
      const stagger = r * 0.35;
      if (p.evolution === 1) makeProjectile(base, stagger, r * 20);
      else if (p.evolution === 2) [-0.24, 0.24].forEach(o => makeProjectile(base, stagger, r * 20));
      else if (p.evolution === 3) [base - .21, base, base + .21].forEach(a => makeProjectile(a, stagger, r * 20));
      else [base - .31, base - .10, base + .10, base + .31].forEach(a => makeProjectile(a, stagger, r * 20));
    }
    this.addFeed('PLAYER_ATTACK', `🌹 @${p.username} MENEMBAK${boosted ? ' ⚡[2X DMG]' : ''}${repeat > 1 ? ` (x${repeat} BARRAGE)` : ''}!`, p.username, p.color);
    return true;
  }

  heal(id) {
    if (this.phase !== 'PLAYING') return false;
    const p = this.players.get(id);
    if (!p || p.status !== 'ALIVE') return false;
    const now = Date.now();
    if (now - p.lastHeal < HEAL_COOLDOWN_MS) return false;
    p.lastHeal = now;
    if (p.hearts >= p.maxHearts) return false;
    p.hearts++;
    this.addEffect('HEAL', p, '#00ff88', '+1 ❤️', 1000);
    this.addFeed('PLAYER_HEAL', `🍩 @${p.username} ISI DARAH! (${p.hearts}/${p.maxHearts} ❤️)`, p.username, '#00ff88');
    return true;
  }

  damageBuff(id) {
    const p = this.players.get(id); if (!p || p.status !== 'ALIVE') return false;
    p.damageBoostUntil = Date.now() + DAMAGE_BUFF_SECONDS * 1000;
    p.damageBoostMultiplier = 2;
    this.addEffect('BUFF', p, '#ffd000', `⚡ 2X DAMAGE (${DAMAGE_BUFF_SECONDS}s)`, 1800);
    this.addFeed('PLAYER_DAMAGE_BUFF', `⚡ @${p.username} AKTIFKAN 2X DAMAGE!`, p.username, '#ffd000');
    return true;
  }

  manualEvolve(id) {
    const p = this.players.get(id); if (!p || p.status !== 'ALIVE') return false;
    if (p.evolution < 4) p.evolution++;
    const spec = EVOLUTIONS[p.evolution];
    this.addEffect('EVOLUTION', p, spec.bonus, `🎩 ${spec.title}`, 2500);
    this.addFeed('PLAYER_EVOLVE_MANUAL', `🎩 @${p.username} EVOLUSI MANUAL → ${spec.title}!`, p.username, p.color);
    return true;
  }

  special(id) {
    if (this.phase !== 'PLAYING') return false;
    const p = this.players.get(id); if (!p || p.status !== 'ALIVE') return false;
    const base = p.angle * Math.PI / 180;
    for (const a of [base - .22, base, base + .22]) {
      const m = { x: p.x + Math.sin(a) * 1.45, z: p.z + Math.cos(a) * 1.45 };
      this.projectiles.push({ id: `S-${Date.now()}-${Math.random()}`, ownerId: id, ownerUsername: p.username, ownerColor: p.color, x: m.x, z: m.z, vx: Math.sin(a) * PROJECTILE_SPEED * 1.1, vz: Math.cos(a) * PROJECTILE_SPEED * 1.1, damage: 2, evolution: p.evolution, boosted: true, bornAt: Date.now() });
    }
    this.addEffect('SPECIAL', p, '#ff007f', 'SPECIAL BARRAGE!', 1200);
    this.addFeed('PLAYER_SPECIAL', `⚡ @${p.username} UNLEASHED SPECIAL TRIPLE BARRAGE!`, p.username, p.color);
    return true;
  }

  revive(id) {
    const p = this.players.get(id); if (!p) return false;
    if (p.status === 'ALIVE') return this.heal(id);
    p.status = 'ALIVE'; p.hearts = p.maxHearts;
    this.addEffect('SPAWN', p, '#ffd700', 'REVIVED!', 1500);
    this.addFeed('PLAYER_REVIVE', `🔥 @${p.username} TELAH DIHIDUPKAN KEMBALI!`, p.username, '#ffd700');
    return true;
  }

  tick(dt = 1 / 30) {
    const now = Date.now();
    this.processQueue();
    this.effects = this.effects.filter(e => now - e.createdAt < e.durationMs);
    for (const p of this.players.values()) {
      if (p.status !== 'ALIVE') continue;
      if (now > p.nextDirChange) {
        if (Math.random() < .6) p.rotationDir *= -1;
        p.rotationSpeed = 38 + Math.floor(Math.random() * 45);
        p.nextDirChange = now + 6000 + Math.random() * 10000;
      }
      p.angle = (p.angle + dt * p.rotationSpeed * p.rotationDir + 360) % 360;
    }
    if (this.phase === 'COUNTDOWN') {
      this.countdown -= dt; this.remaining = Math.max(0, this.countdown);
      if (this.countdown <= 0) { this.phase = 'PLAYING'; this.remaining = MATCH_SECONDS; this.addFeed('SYSTEM', '⚔️ BATTLE STARTED! FIRE AT WILL!'); }
    } else if (this.phase === 'PLAYING') {
      this.remaining -= dt;
      this.updateProjectiles(dt, now);
      const alive = [...this.players.values()].filter(p => p.status === 'ALIVE');
      if (this.remaining <= 0 || (this.players.size >= 2 && alive.length <= 1)) this.finishMatch();
    } else if (this.phase === 'MATCH_END') {
      this.remaining -= dt;
      if (this.remaining <= 0) { this.phase = 'RESULT'; this.remaining = RESULT_SECONDS; }
    } else if (this.phase === 'RESULT') {
      this.remaining -= dt;
      if (this.remaining <= 0) this.resetMatch();
    }
    this.emit();
  }

  updateProjectiles(dt, now) {
    const next = [];
    for (const b of this.projectiles) {
      if (b.bornAt > now) { next.push(b); continue; }
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (Math.abs(b.x) > 12 || Math.abs(b.z) > 10) continue;
      let hit = false;
      for (const t of this.players.values()) {
        if (t.platformUserId === b.ownerId || t.status !== 'ALIVE') continue;
        if (Math.hypot(t.x - b.x, t.z - b.z) < 1.3) {
          hit = true;
          const a = this.players.get(b.ownerId);
          if (a) { a.damageDealt += b.damage; }
          t.hearts = Math.max(0, t.hearts - b.damage);
          this.addEffect('HIT', t, '#ff3b30', `-${b.damage} ❤️`, 500);
          if (t.hearts <= 0) {
            t.status = 'DEAD'; t.deaths++;
            this.addEffect('EXPLOSION', t, '#ff8c00', 'ELIMINATED!', 1200);
            if (a) {
              a.kills++; a.score += 150;
              const g = this.ensureGlobal(a); g.totalKills++; g.totalDamage += b.damage; g.highestEvolution = Math.max(g.highestEvolution, a.evolution); g.lastPlayedAt = now;
              this.checkEvolution(a);
              this.addFeed('SYSTEM', `💀 @${a.username} KILLED @${t.username}! (${a.kills} KILLS)`, a.username, a.color);
            }
          }
          break;
        }
      }
      if (!hit) next.push(b);
    }
    this.projectiles = next;
  }

  checkEvolution(p) {
    let level = 1;
    if (p.kills >= 12) level = 4; else if (p.kills >= 7) level = 3; else if (p.kills >= 3) level = 2;
    if (level > p.evolution) {
      p.evolution = level;
      const spec = EVOLUTIONS[level];
      this.addEffect('EVOLUTION', p, spec.bonus, `🔥 ${spec.title}!`, 2000);
      this.addFeed('SYSTEM', `🔥 @${p.username} EVOLVED TO ${spec.title}!`, p.username, p.color);
    }
  }

  finishMatch() {
    if (this.phase !== 'PLAYING') return;
    const ranking = [...this.players.values()].sort((a,b) => b.kills-a.kills || b.hearts-a.hearts || b.damageDealt-a.damageDealt || b.evolution-a.evolution);
    this.winner = ranking[0] || null;
    for (const p of this.players.values()) {
      const g = this.ensureGlobal(p); g.totalMatches++; g.totalDamage += p.damageDealt; g.highestEvolution = Math.max(g.highestEvolution, p.evolution); g.lastPlayedAt = Date.now();
      if (this.winner && p.platformUserId === this.winner.platformUserId) { g.totalWins++; p.score += 500; }
    }
    this.phase = 'MATCH_END'; this.remaining = MATCH_END_SECONDS;
    if (this.winner) this.addFeed('SYSTEM', `🏆 MATCH SELESAI! JUARA: @${this.winner.username} (${this.winner.kills} Kills & ${this.winner.hearts} Hearts)!`, this.winner.username, this.winner.color);
  }

  state() {
    const players = [...this.players.values()].sort((a,b) => a.slot-b.slot);
    const matchLeaderboard = [...players].sort((a,b) => b.kills-a.kills || b.hearts-a.hearts || b.damageDealt-a.damageDealt || b.evolution-a.evolution);
    const globalLeaderboard = [...this.globalStats.values()].sort((a,b) => b.totalKills-a.totalKills || b.totalWins-a.totalWins || b.totalMatches-a.totalMatches || b.totalDamage-a.totalDamage).slice(0,10);
    return { matchId:this.matchId, phase:this.phase, theme:this.theme, remaining:Math.max(0,Math.ceil(this.remaining)), maxPlayers:MAX_PLAYERS, players, projectiles:this.projectiles, effects:this.effects, feed:this.feed.slice(-15), winner:this.winner, matchLeaderboard, globalLeaderboard, serverTime:Date.now() };
  }
}
