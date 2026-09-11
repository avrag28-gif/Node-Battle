const THEMES = [
  { id: 'DESERT', name: 'Desert Battlefield' },
  { id: 'ICE', name: 'Frozen Battlefield' },
  { id: 'VOLCANIC', name: 'Alien Volcanic Battlefield' }
];

const MAX_PLAYERS = 5;
const MAX_HEARTS = 5;
const MATCH_SECONDS = 240;
const EVOLUTION_KILLS = [5, 10, 15];

const slots = [
  { x: -7, z: -5, angle: 45 },
  { x: 7, z: -5, angle: -45 },
  { x: -7, z: 5, angle: 135 },
  { x: 7, z: 5, angle: -135 },
  { x: 0, z: 7, angle: 180 }
];

export class Game {
  constructor() {
    this.players = new Map();
    this.projectiles = [];
    this.effects = [];
    this.globalStats = new Map();
    this.listeners = new Set();
    this.themeIndex = -1;
    this.resetMatch();
  }

  subscribe(fn) { this.listeners.add(fn); fn(this.state()); return () => this.listeners.delete(fn); }
  emit() { const s = this.state(); for (const fn of this.listeners) fn(s); }

  nextTheme() {
    let next = Math.floor(Math.random() * THEMES.length);
    if (THEMES.length > 1 && next === this.themeIndex) next = (next + 1) % THEMES.length;
    this.themeIndex = next;
    return THEMES[next];
  }

  resetMatch() {
    for (const p of this.players.values()) this.recordMatch(p);
    this.players.clear();
    this.projectiles = [];
    this.effects = [];
    this.startedAt = null;
    this.phase = 'WAITING';
    this.matchId = `M-${Date.now()}`;
    this.remaining = MATCH_SECONDS;
    this.theme = this.nextTheme();
    this.emit();
  }

  recordMatch(p) {
    if (!p || !p.platformUserId) return;
    const s = this.globalStats.get(p.platformUserId) || {
      platformUserId: p.platformUserId, username: p.username,
      totalKills: 0, totalMatches: 0, totalWins: 0, highestEvolution: 1, lastPlayedAt: 0
    };
    s.username = p.username;
    s.totalKills += p.kills;
    s.totalMatches += 1;
    s.highestEvolution = Math.max(s.highestEvolution, p.evolution);
    s.lastPlayedAt = Date.now();
    this.globalStats.set(p.platformUserId, s);
  }

  addPlayer(platformUserId, username, avatarUrl) {
    if (this.phase === 'RESULT') return { ok: false, reason: 'MATCH_ENDED' };
    if (this.players.has(platformUserId)) return { ok: false, reason: 'ALREADY_IN_MATCH' };
    if (this.players.size >= MAX_PLAYERS) return { ok: false, reason: 'ARENA_FULL' };
    const slot = slots.findIndex((_, i) => ![...this.players.values()].some(p => p.slot === i));
    const p = {
      id: `P-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      platformUserId, username: String(username || 'Player').slice(0, 24), avatarUrl,
      slot, hearts: MAX_HEARTS, maxHearts: MAX_HEARTS, kills: 0, deaths: 0,
      damageDealt: 0, evolution: 1, status: 'ALIVE',
      x: slots[slot].x, z: slots[slot].z, angle: slots[slot].angle,
      joinedAt: Date.now(), lastActionAt: 0
    };
    this.players.set(platformUserId, p);
    if (!this.globalStats.has(platformUserId)) this.globalStats.set(platformUserId, {
      platformUserId, username: p.username, totalKills: 0, totalMatches: 0, totalWins: 0,
      highestEvolution: 1, lastPlayedAt: Date.now()
    });
    if (this.players.size >= 2 && this.phase === 'WAITING') { this.phase = 'PLAYING'; this.startedAt = Date.now(); }
    this.emit();
    return { ok: true, player: p };
  }

  attack(attackerId, targetId) {
    if (this.phase !== 'PLAYING') return false;
    const a = this.players.get(attackerId); const t = this.players.get(targetId);
    if (!a || !t || a.status !== 'ALIVE' || t.status !== 'ALIVE' || a.id === t.id) return false;
    const now = Date.now();
    if (now - a.lastActionAt < 250) return false;
    a.lastActionAt = now;
    const damage = a.evolution;
    t.hearts = Math.max(0, t.hearts - 1);
    a.damageDealt += damage;
    this.projectiles.push({ id: `B-${now}-${Math.random()}`, from: a.id, to: t.id, damage, bornAt: now });
    if (t.hearts <= 0) {
      t.deaths += 1; t.status = 'DEAD'; a.kills += 1;
      a.evolution = EVOLUTION_KILLS.filter(k => a.kills >= k).length + 1;
      if (a.evolution > 4) a.evolution = 4;
    }
    this.emit(); return true;
  }

  heal(id) {
    if (this.phase !== 'PLAYING') return false;
    const p = this.players.get(id); if (!p || p.status !== 'ALIVE') return false;
    p.hearts = Math.min(MAX_HEARTS, p.hearts + 1); this.emit(); return true;
  }

  tick() {
    const now = Date.now();
    this.projectiles = this.projectiles.filter(x => now - x.bornAt < 450);
    if (this.phase === 'PLAYING') {
      this.remaining = Math.max(0, MATCH_SECONDS - Math.floor((now - this.startedAt) / 1000));
      if (this.remaining <= 0 || this.aliveCount() <= 1) this.endMatch();
      this.emit();
    }
  }

  aliveCount() { return [...this.players.values()].filter(p => p.status === 'ALIVE').length; }

  endMatch() {
    if (this.phase !== 'PLAYING') return;
    const list = [...this.players.values()].sort((a,b) => b.kills-a.kills || b.hearts-a.hearts || b.damageDealt-a.damageDealt);
    this.winner = list[0];
    if (this.winner) {
      const s = this.globalStats.get(this.winner.platformUserId);
      if (s) s.totalWins += 1;
    }
    this.phase = 'RESULT'; this.emit();
  }

  state() {
    const players = [...this.players.values()].sort((a,b) => a.slot-b.slot);
    const matchLeaderboard = [...players].sort((a,b) => b.kills-a.kills || b.hearts-a.hearts || b.damageDealt-a.damageDealt);
    const globalLeaderboard = [...this.globalStats.values()]
      .sort((a,b) => b.totalKills-a.totalKills || b.totalWins-a.totalWins || b.totalMatches-a.totalMatches)
      .slice(0, 10);
    return {
      matchId: this.matchId, phase: this.phase, theme: this.theme,
      remaining: this.remaining, maxPlayers: MAX_PLAYERS,
      players, projectiles: this.projectiles, winner: this.winner || null,
      matchLeaderboard, globalLeaderboard, serverTime: Date.now()
    };
  }
}
