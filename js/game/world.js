// OFF-LEASH — pure combat sim. No DOM, no canvas, no audio, no Math.random.
// Side view: x = across, y = feet height (y grows down, ground at GROUND_Y).
// Flat plane + jumps; Smash-lite juggles. Everything lethal telegraphs.
// Deterministic: seeded rng only; events[] drives all feedback.
// M3: the full 43-move pool (stances, fields, marks, trades — no plain
// projectiles) + the 20-form system with essence evolution.
import { clamp, sign } from '../engine/vec.js';
import { MOVES } from '../data/moves.js';
import { FORMS } from '../data/forms.js';

export const GROUND_Y = 460;
export const GRAV = 2200;
export const MOVE_SPD = 300;
const JUMP_VY = -780;
const DJUMP_VY = -680;
const DIVE_VY = 1400;
const BUFFER = 0.1;
const COYOTE = 0.08;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rectsHit = (ax, ay, aw, ah, bx, by, bw, bh) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

// ---------- player attack data (the A-grammar) ----------
export const ATTACKS = {
  c1: { startup: 0.07, active: 0.10, recovery: 0.12, hb: { ox: 18, oy: -44, w: 44, h: 34 }, dmg: 8, kb: { vx: 120, vy: 0 }, hitstop: 0.04, next: 'c2', cancelFrom: 0.14, anim: 'atk0' },
  c2: { startup: 0.06, active: 0.10, recovery: 0.12, hb: { ox: 20, oy: -46, w: 46, h: 36 }, dmg: 9, kb: { vx: 150, vy: 0 }, hitstop: 0.045, next: 'c3', cancelFrom: 0.14, anim: 'atk1' },
  c3: { startup: 0.10, active: 0.12, recovery: 0.20, hb: { ox: 22, oy: -48, w: 52, h: 40 }, dmg: 14, kb: { vx: 380, vy: -140 }, hitstop: 0.08, next: null, anim: 'atk1' },
  launcher: { startup: 0.11, active: 0.12, recovery: 0.24, hb: { ox: 14, oy: -60, w: 44, h: 56 }, dmg: 10, kb: { vx: 40, vy: -720 }, hitstop: 0.08, launch: true, anim: 'atkUp' },
  aerial: { startup: 0.06, active: 0.11, recovery: 0.12, hb: { ox: 16, oy: -46, w: 46, h: 40 }, dmg: 9, kb: { vx: 110, vy: -160 }, hitstop: 0.05, air: true, anim: 'air' },
  divehit: { startup: 0, active: 0.10, recovery: 0.18, hb: { ox: -40, oy: -20, w: 80, h: 30 }, dmg: 13, kb: { vx: 160, vy: -300 }, hitstop: 0.09, launch: true, anim: 'air' },
};

// legacy export (M1 tests/hud referenced it) — SNIG's base kit ids
export const KIT = FORMS.snig.kit.map((id) => ({ id, name: MOVES[id].name, cd: MOVES[id].cd }));

// ---------- bestiary — every lethal thing telegraphs ----------
// behavior: rush (charge) · spit (arcing glob→puddle) · dive (flier plunges) ·
// whip (root you, mash out) · slam (armored, overhead AoE) · peck (+retaliates
// after your 3rd chain hit) · smog (area denial) · toll (buffs the pack —
// interrupt it!) · drift (floating juggle-bait) · netdrop (drone) · static
// (ward pylon shields allies) · royal (REGENT) · leash (the Keeper)
export const BESTIARY = {
  skitterlin: { name: 'Skitterlin', behavior: 'rush', hp: 18, dmg: 6, w: 30, h: 26, walk: 150, tell: 0.3, attackT: 0.28, attackV: 420, recover: 0.7, essence: 'static' },
  growler: { name: 'Growler', behavior: 'rush', hp: 55, dmg: 12, w: 44, h: 38, walk: 105, tell: 0.55, attackT: 0.34, attackV: 640, recover: 0.95, essence: 'rust' },
  dripjaw: { name: 'Dripjaw', behavior: 'spit', hp: 45, dmg: 10, w: 40, h: 30, walk: 55, tell: 0.5, attackT: 0.2, recover: 1.2, essence: 'rain', range: 340 },
  sparkfly: { name: 'Sparkfly', behavior: 'dive', hp: 26, dmg: 8, w: 26, h: 24, walk: 130, tell: 0.45, attackT: 0.4, attackV: 560, recover: 0.9, essence: 'moon', fly: 150 },
  bindler: { name: 'Bindler', behavior: 'whip', hp: 40, dmg: 8, w: 30, h: 34, walk: 95, tell: 0.5, attackT: 0.25, recover: 1.0, essence: 'static', whipLen: 150, rootT: 1.4 },
  slabby: { name: 'Slabby', behavior: 'slam', hp: 70, dmg: 14, w: 46, h: 42, walk: 55, tell: 0.8, attackT: 0.3, recover: 1.2, essence: 'rust', poise: 30, slamR: 120 },
  wharfhag: { name: 'Wharfhag', behavior: 'peck', hp: 60, dmg: 11, w: 34, h: 44, walk: 90, tell: 0.45, attackT: 0.25, attackV: 300, recover: 0.9, essence: 'rain', retaliate: true },
  chimeneer: { name: 'Chimeneer', behavior: 'smog', hp: 55, dmg: 8, w: 40, h: 40, walk: 60, tell: 0.6, attackT: 0.3, recover: 1.4, essence: 'rust', smogR: 110, smogT: 4 },
  moonjelly: { name: 'Moonjelly', behavior: 'drift', hp: 50, dmg: 10, w: 30, h: 28, walk: 45, tell: 0.5, attackT: 0.5, recover: 1.0, essence: 'moon', fly: 110 },
  bellwether: { name: 'Bellwether', behavior: 'toll', hp: 55, dmg: 10, w: 42, h: 38, walk: 70, tell: 0.9, attackT: 0.3, recover: 1.6, essence: 'moon', buffT: 6, elite: true },
  // machines
  tinny: { name: 'Tinny', behavior: 'rush', hp: 14, dmg: 5, w: 26, h: 26, walk: 180, tell: 0.25, attackT: 0.22, attackV: 460, recover: 0.6, essence: 'static', machine: true },
  snaredrone: { name: 'Snare Drone', behavior: 'netdrop', hp: 30, dmg: 0, w: 34, h: 22, walk: 120, tell: 0.7, attackT: 0.2, recover: 2.2, essence: 'static', machine: true, fly: 210 },
  wardpylon: { name: 'Ward Pylon', behavior: 'static', hp: 50, dmg: 0, w: 28, h: 60, walk: 0, tell: 1, attackT: 1, recover: 1, essence: 'rust', machine: true, shieldR: 220 },
  bloodhound: { name: 'Bloodhound Unit', behavior: 'rush', hp: 120, dmg: 14, w: 52, h: 40, walk: 225, tell: 0.4, attackT: 0.4, attackV: 700, recover: 0.8, essence: 'rust', machine: true, poise: 20 },
  // the Keeper's family & court
  echo_wick: { name: 'Echo of Wick', behavior: 'rush', hp: 70, dmg: 12, w: 30, h: 40, walk: 170, tell: 0.4, attackT: 0.28, attackV: 700, recover: 0.7, essence: 'moon', sprite: 'wick' },
  echo_phossa: { name: 'Echo of Phossa', behavior: 'dive', hp: 80, dmg: 12, w: 32, h: 32, walk: 120, tell: 0.45, attackT: 0.4, attackV: 560, recover: 0.9, essence: 'moon', fly: 140, sprite: 'phossa' },
  echo_dent: { name: 'Echo of Dent', behavior: 'slam', hp: 110, dmg: 14, w: 44, h: 46, walk: 50, tell: 0.75, attackT: 0.3, recover: 1.1, essence: 'moon', poise: 25, slamR: 120, sprite: 'dent' },
  regent: { name: 'REGENT', behavior: 'royal', hp: 220, dmg: 16, w: 46, h: 48, walk: 110, tell: 0.55, attackT: 0.32, attackV: 520, recover: 0.9, essence: 'moon', poise: 25 },
  keeper: { name: 'THE KEEPER', behavior: 'leash', hp: 300, dmg: 18, w: 34, h: 56, walk: 90, tell: 0.7, attackT: 0.35, recover: 1.1, essence: 'rust' },
};

export function mkPlayer() {
  return {
    kind: 'player', species: 'snig', form: 'snig',
    x: 200, y: GROUND_Y, vx: 0, vy: 0, w: 34, h: 40,
    facing: 1, onGround: true, jumps: 2, maxJumps: 2, coyoteT: 0,
    hp: 100, maxHp: 100,
    spdMult: 1, dmgMult: 1,
    state: 'idle', animT: 0,
    atk: null,
    dashT: 0, dashDir: 1, dashCd: 0,
    diving: false,
    hurtT: 0, iframes: 0,
    // kit: three move instances {id, tier}
    moves: FORMS.snig.kit.map((id) => ({ id, tier: 0 })),
    cds: [0, 0, 0],
    // stances & buffs (all timers in seconds; 0 = off)
    guardT: 0, guardLastT: -99, guardTier: 0,
    parryT: 0, parryTier: 0,
    veilT: 0,
    napT: 0, napHeal: 0,
    bide: null,        // {t, stored, mult, launch}
    focus: null,       // {t, dmg, aoe, lateArmor}
    endureT: 0, endureSurge: false, endured: false,
    overclockT: 0, overclockExt: 0,
    livewireT: 0, livewireDmg: 0, livewireChip: 0,
    siphonT: 0, siphonSteal: 0,
    whetHits: 0, whetMult: 1,
    platingT: 0, platDr: 0, platSlow: 0, platThorns: false,
    furyOn: false, furyStacks: 0, furyPer: 0.1, furyMax: 5,
    zgT: 0, zgAirDmg: 1, zgFloat: false,
    cbT: 0, cbCdr: 0, cbTrickle: 0,
    aiT: 0,            // afterimage
    pactMult: 1,
    stacks: 0, stackMax: 3,
    digT: 0, rollT: 0, rollDmg: 0, rollRamp: 0, rollHits: 0,
    hopT: 0, hopDef: null,
    buffer: [],
    pdodges: 0, combo: 0, comboT: 0,
    rootT: 0, struggleNeed: 0, struggleTick: 0,
    hitSinceAtk: false, // Cold Receipt: were we hit since our last attack?
  };
}

export function applyForm(w, formId) {
  const p = w.player;
  const F = FORMS[formId];
  if (!F) return;
  const hpFrac = p.hp / p.maxHp;
  p.form = formId;
  p.species = F.cryptid;
  p.maxHp = Math.round(F.stats.hp * (1 + (w.levelHpBonus || 0)));
  p.hp = Math.max(1, Math.round(p.maxHp * hpFrac));
  p.spdMult = F.stats.spd;
  p.dmgMult = F.stats.dmg;
  p.maxJumps = F.stats.jumps || 2;
  p.moves = F.kit.map((id) =>
    MOVES[id].gated && !(w.gatedOk && w.gatedOk.has(id))
      ? { id: 'blinkstep', tier: 0, locked: id }
      : { id, tier: 0 });
  p.cds = [0, 0, 0];
  w.events.push({ t: 'form', form: formId, name: F.name });
}

function mkFoe(w, species, x, over = {}) {
  const B = BESTIARY[species];
  const f = {
    kind: 'foe', species,
    x, y: B.fly ? GROUND_Y - B.fly : GROUND_Y, vx: 0, vy: 0, w: B.w, h: B.h,
    facing: -1, onGround: !B.fly,
    fly: B.fly || 0,
    poise: B.poise || 0, maxPoise: B.poise || 0,
    dmgOver: over.dmg,
    hp: over.hp || B.hp, maxHp: over.hp || B.hp,
    state: 'idle', stateT: 0.4 + w.rng() * 0.6, animT: w.rng() * 10,
    attackHit: false, hitFlash: 0, juggle: 0,
    // statuses
    paralyzedT: 0, asleepT: 0, sleepMarkT: 0,
    vulnT: 0, vulnMult: 1,
    burr: null, ariaT: 0, ariaTag: false,
    encoreN: 0, heldT: 0,
    slowedT: 0,
  };
  w.foes.push(f);
  return f;
}

export function createWorld(seed = 1) {
  return {
    t: 0,
    rng: mulberry32(seed),
    arena: { w: 1280, name: 'the practice yard' },
    cam: { x: 0 },
    player: mkPlayer(),
    foes: [],
    pylons: [],
    pickups: [],
    zones: [],       // {type:'snare'|'caltrops'|'puddle'|'smog'|..., x, r, t, ...}
    eshots: [],      // enemy/gadget projectiles {x,y,vx,vy,grav,type}
    trainer: null,   // the hunter directing this boss fight
    keeper: null,    // the finale's phase machine
    friend: null,    // escort missions {x, hp, ...}
    cages: [],       // rescue missions {x, lockT, opened}
    chase: null,     // auto-scroll escapes {speed, dist, done}
    tollT: 0,        // Bellwether pack-frenzy
    panes: [],       // Glass Ward {x, w, t, shock}
    decoy: null,     // {x, hp, t, boom}
    curfewT: 0, curfewSlow: 1,
    mission: null,
    boss: null,
    essenceGained: { static: 0, rain: 0, rust: 0, moon: 0 },
    events: [],
    slowmoT: 0,
    msg: null, msgT: 0,
    over: false, overCause: null,
    paused: false,
    levelHpBonus: 0,
    pursuit: null,   // set by main.js: {spotters,curfew,ration,marked} — inert when null
  };
}

// ---------- missions ----------
export function startMission(w, def) {
  w.mission = { def, wave: 0, done: false };
  w.arena = { w: def.arenaW, name: def.arena };
  w.foes.length = 0; w.pylons.length = 0; w.pickups.length = 0;
  w.zones.length = 0; w.panes.length = 0; w.decoy = null;
  w.player.x = 120; w.player.y = GROUND_Y; w.player.combo = 0;
  w.cam.x = 0;
  w.cages.length = 0; w.friend = null; w.chase = null;
  if (def.pylons > 0) {
    for (let i = 0; i < def.pylons; i++) {
      w.pylons.push({ x: def.arenaW * (0.45 + i * 0.22), hp: 60, maxHp: 60 });
    }
  }
  if (def.type === 'rescue') {
    w.cages.push({ x: def.arenaW * 0.5, lockT: 6, opened: false });
    w.cages.push({ x: def.arenaW * 0.85, lockT: 6, opened: false });
  }
  if (def.type === 'escort') {
    w.friend = { x: 90, y: GROUND_Y, hp: 40, maxHp: 40, speed: 62, w: 26, h: 26, ambushed: [] };
    w.player.x = 150;
  }
  if (def.type === 'chase') {
    w.arena.w = def.arenaW; // long straight
    mkFoe(w, 'bloodhound', 40);
    for (let i = 1; i <= 3; i++) w.pylons.push({ x: def.arenaW * (0.25 * i) + 120, hp: 30, maxHp: 30, barrier: true });
  }
  // Pursuit 1 — Spotters: every arena patrols a Snare Drone.
  if (w.pursuit && w.pursuit.spotters && def.type !== 'chase') {
    mkFoe(w, 'snaredrone', Math.min(def.arenaW - 100, 520));
  }
  if (def.waves && def.type !== 'chase') spawnWave(w);
  const OBJ = { sabotage: 'Smash the pylons', rescue: 'Break the cages open — stand close and hold the line', escort: 'Get the little one to the far fence. Keep it breathing', chase: 'RUN. Smash what blocks you — it is right behind you' };
  toast(w, `${OBJ[def.type] || 'Clear them out'} — ${def.arena}.`, 3.2);
}

function spawnWave(w) {
  const def = w.mission.def;
  const wave = def.waves[w.mission.wave % def.waves.length];
  for (const e of wave) mkFoe(w, e.s, clamp(def.arenaW * e.x, 60, def.arenaW - 60));
  w.events.push({ t: 'wave', n: w.mission.wave + 1 });
}

export function startBoss(w, bossDef) {
  w.mission = null;
  w.arena = { w: 1200, name: bossDef.name };
  w.foes.length = 0; w.pylons.length = 0; w.pickups.length = 0;
  w.zones.length = 0; w.panes.length = 0; w.decoy = null;
  w.player.x = 140; w.player.y = GROUND_Y;
  w.cam.x = 0;
  const f = mkFoe(w, bossDef.species, 900);
  f.hp = f.maxHp = bossDef.hp;   // FLAT authored — never scaled
  f.boss = bossDef;
  f.scale = bossDef.scale;
  f.w *= bossDef.scale; f.h *= bossDef.scale;
  w.boss = f;
  for (const s of bossDef.adds) mkFoe(w, s, 1050 + w.rng() * 100);
  toast(w, `${bossDef.name} bars the way.`, 3.0);
  w.events.push({ t: 'boss_start', name: bossDef.name });
}

export function seedPractice(w) {
  mkFoe(w, 'growler', 700);
  mkFoe(w, 'skitterlin', 950);
  mkFoe(w, 'skitterlin', 1050);
  if (w.sparEchoes) mkFoe(w, 'echo_wick', 500, { hp: 70, dmg: 8 });
}

function toast(w, text, dur = 2.2) { w.msg = text; w.msgT = dur; }

// ---------- hit resolution ----------
function playerHitbox(p, def) {
  const x = p.facing > 0 ? p.x + def.hb.ox : p.x - def.hb.ox - def.hb.w;
  return [x, p.y + def.hb.oy, def.hb.w, def.hb.h];
}
const foeHurtbox = (f) => [f.x - f.w / 2, f.y - f.h, f.w, f.h];
const playerHurtbox = (p) => [p.x - p.w / 2, p.y - p.h, p.w, p.h];

// outgoing damage multiplier (consumes whetstone hits)
function outMult(w) {
  const p = w.player;
  let m = p.dmgMult * p.pactMult;
  if (p.whetHits > 0) { m *= p.whetMult; p.whetHits--; if (p.whetHits === 0) p.whetMult = 1; }
  if (p.furyOn) m *= 1 + p.furyStacks * p.furyPer;
  if (!p.onGround && p.zgT > 0) m *= p.zgAirDmg;
  return m;
}

function markPerfect(w, f) {
  const p = w.player;
  if (f.pdodged) return;
  f.pdodged = true;
  p.pdodges++;
  p.stacks = Math.min(p.stackMax, p.stacks + 1);
  p.lastPerfectT = w.t;
  w.slowmoT = 0.35;
  w.events.push({ t: 'pdodge', x: p.x, y: p.y - 60 });
}

function damageFoe(w, f, def, mul = 1, opts = {}) {
  const p = w.player;
  // Ward Pylons shield nearby allies entirely
  if (!BESTIARY[f.species]?.machine || f.species === 'bloodhound') {
    const ward = w.foes.find((o) => !o.dead && o.species === 'wardpylon' && Math.abs(o.x - f.x) < BESTIARY.wardpylon.shieldR);
    if (ward && f.species !== 'wardpylon') {
      w.events.push({ t: 'warded', x: f.x, y: f.y - f.h / 2 });
      return;
    }
  }
  let m = mul * (opts.raw ? 1 : outMult(w));
  if (f.vulnT > 0) m *= f.vulnMult;
  if (f.asleepT > 0) { if (f.sleepCrit) m *= 2; f.asleepT = 0; } // damage wakes
  const dmg = Math.max(1, Math.round(def.dmg * m));
  // poise armor: heavy hits and armor-breakers chew it; light hits bounce off
  if (f.poise > 0) {
    const heavy = def.armorbreak || dmg >= 13 || def.launch;
    f.poise -= dmg * (heavy ? 1.4 : 0.5);
    f.hitFlash = 0.06;
    if (f.poise <= 0) {
      f.poise = 0;
      f.state = 'hurt'; f.stateT = 1.2;
      w.events.push({ t: 'armorbreak', x: f.x, y: f.y - f.h });
    } else {
      w.events.push({ t: 'clink', x: f.x, y: f.y - f.h / 2 });
      return;
    }
  }
  // Wharfhag: your 3rd chain hit triggers an instant riposte (short flash-tell)
  if (BESTIARY[f.species]?.retaliate && def === ATTACKS.c3 && f.state !== 'hurt' && !f.dead) {
    f.state = 'tell'; f.stateT = 0.2;
    w.events.push({ t: 'tell', x: f.x, y: f.y - f.h - 10, species: f.species });
  }
  f.hp -= dmg;
  f.hitFlash = 0.09;
  const dir = sign(f.x - p.x) || p.facing;
  const jm = 1 / (1 + 0.25 * f.juggle) * (w.player.zgFloat ? 0.7 : 1);
  f.vx = (def.kb?.vx || 0) * dir * jm;
  if (def.kb?.vy) f.vy = def.kb.vy * jm * (p.zgFloat ? 0.75 : 1);
  if (def.launch || (def.kb?.vy && def.kb.vy < -200)) {
    f.state = 'launched'; f.onGround = false; f.juggle++;
  } else if (f.onGround && f.state !== 'launched') {
    f.state = 'hurt'; f.stateT = 0.22;
  }
  if (!f.onGround) f.juggle++;
  // lifesteal + aria tagging
  if (p.siphonT > 0 && !opts.noSteal) {
    p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.round(dmg * p.siphonSteal)));
  }
  if (f.ariaT > 0) f.ariaTag = true;
  w.events.push({ t: 'hit', x: f.x, y: f.y - f.h / 2, dmg, big: dmg >= 12, hitstop: def.hitstop || 0.04 });
  if (p.atk) p.atk.hit = true;
  p.combo++; p.comboT = 1.4;
  if (f.hp <= 0) killFoe(w, f);
}

function killFoe(w, f) {
  const p = w.player;
  w.events.push({ t: 'foe_down', x: f.x, y: f.y - f.h / 2, species: f.species, combo: p.combo });
  f.dead = true;
  if (f.boss) {
    w.boss = null;
    w.events.push({ t: 'boss_down', name: f.boss.name });
  } else {
    const B = BESTIARY[f.species];
    w.essenceGained[B.essence] = (w.essenceGained[B.essence] || 0) + 1;
    w.events.push({ t: 'xp', amt: f.species === 'growler' ? 14 : 6 });
    w.events.push({ t: 'essence', kind: B.essence, x: f.x, y: f.y - 30 });
    if (f.burr && f.burr.hops) {
      const next = w.foes.find((o) => !o.dead && o !== f);
      if (next) next.burr = f.burr;
    }
    // Pursuit 4 — Rationing: the streets go hungry (heal cans rarer).
    if (w.rng() < (w.pursuit && w.pursuit.ration ? 0.11 : 0.22)) w.pickups.push({ x: f.x, y: GROUND_Y, heal: 12 });
  }
}

function hitPylons(w, def, hx, hy, hw, hh, mul = 1) {
  for (const py of w.pylons) {
    if (py.hp <= 0) continue;
    if (rectsHit(hx, hy, hw, hh, py.x - 18, GROUND_Y - 70, 36, 70)) {
      py.hp -= Math.round(def.dmg * mul);
      w.events.push({ t: 'pylon_hit', x: py.x, y: GROUND_Y - 40, dmg: def.dmg });
      if (py.hp <= 0) w.events.push({ t: 'pylon_down', x: py.x, y: GROUND_Y - 40 });
    }
  }
}

function hurtPlayer(w, dmg, fromX, fromFoe) {
  const p = w.player;
  if (p.iframes > 0 || p.digT > 0) return false;
  if (p.aiT > 0) { // afterimage: the hit met a decoy image
    p.aiT = 0;
    w.events.push({ t: 'blocked', x: p.x, y: p.y - 50 });
    return false;
  }
  if (p.guardT > 0) {
    w.events.push({ t: 'blocked', x: p.x, y: p.y - 50 });
    if (p.guardTier >= 2 && p.guardT < 0.15) { // perfect-timed block refunds
      for (let i = 0; i < 3; i++) if (p.moves[i].id === 'umbrella') p.cds[i] = 0;
      w.events.push({ t: 'ability', name: 'Perfect Guard', x: p.x, y: p.y - 66 });
    }
    return false;
  }
  if (p.parryT > 0 && fromFoe) {
    // Counter: negate and return
    const T = MOVES.payback.tiers[p.parryTier];
    p.parryT = 0;
    damageFoe(w, fromFoe, { dmg: dmg * T.mult, kb: { vx: 320, vy: -200 }, hitstop: 0.1 }, 1, { raw: true });
    if (T.heal) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * T.heal));
    w.events.push({ t: 'interrupt', x: p.x, y: p.y - 60 });
    return false;
  }
  let final = dmg;
  if (p.platingT > 0) final = Math.max(1, Math.round(final * (1 - p.platDr)));
  if (p.bide) { p.bide.stored += final; }
  if (p.napT > 0) { // interrupted mid-nap: heal only the elapsed fraction
    const frac = 1 - p.napT / p.napChan;
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * p.napHeal * frac));
    p.napT = 0;
    w.events.push({ t: 'ability', name: 'Rudely woken', x: p.x, y: p.y - 60 });
  }
  if (p.focus) { p.focus = null; w.events.push({ t: 'ability', name: 'Fizzled!', x: p.x, y: p.y - 60 }); } // Focus Punch rule
  p.hp -= final;
  if (p.endureT > 0 && p.hp <= 0) {
    p.hp = 1;
    if (!p.endured && p.endureSurge) { p.overclockT = Math.max(p.overclockT, 2); }
    p.endured = true;
    w.events.push({ t: 'ability', name: 'Stray’s Grit!', x: p.x, y: p.y - 60 });
  }
  if (p.furyOn) p.furyStacks = Math.min(p.furyMax, p.furyStacks + 1);
  p.hitSinceAtk = true;
  p.iframes = 0.9;
  p.hurtT = 0.3;
  p.combo = 0;
  p.vx = sign(p.x - fromX) * 220;
  if (p.platThorns && fromFoe) { fromFoe.state = 'hurt'; fromFoe.stateT = 0.3; }
  w.events.push({ t: 'player_hurt', x: p.x, y: p.y - 40, dmg: final });
  if (p.hp <= 0) {
    p.hp = 0;
    w.over = true;
    w.overCause = w.lastThreat || 'the streets';
    w.events.push({ t: 'defeat', cause: w.overCause });
  }
  return true;
}

// ---------- the move engine: 43 verbs, one compact switch ----------
function nearestFoe(w, filter, range = 400) {
  const p = w.player;
  let best = null, bd = range;
  for (const f of w.foes) {
    if (f.dead || (filter && !filter(f))) continue;
    const d = Math.abs(f.x - p.x);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}
const foesNear = (w, x, r) => w.foes.filter((f) => !f.dead && Math.abs(f.x - x) < r);

export function useMove(w, slot) {
  const p = w.player;
  const mv = p.moves[slot];
  if (!mv || p.cds[slot] > 0 || p.hurtT > 0 || p.napT > 0 || p.digT > 0) return;
  const M = MOVES[mv.id];
  const T = M.tiers[mv.tier];
  const setCd = (mul = 1) => { p.cds[slot] = M.cd * mul * (p.cbT > 0 ? 1 - p.cbCdr : 1); };
  const announce = () => w.events.push({ t: 'ability', name: M.name, x: p.x, y: p.y - 60 });
  const strike = (dmg, kb, opts) => ({ dmg, kb: kb || { vx: 200, vy: 0 }, hitstop: 0.07, ...opts });

  switch (mv.id) {
    // -------- STATIC --------
    case 'blinkstep': {
      p.x += p.facing * T.dist; p.iframes = Math.max(p.iframes, 0.14);
      p.x = clamp(p.x, 20, w.arena.w - 20);
      const f = nearestFoe(w, null, 90);
      if (f) { damageFoe(w, f, strike(T.dmg * (T.resetBonus && p.combo === 0 ? T.resetBonus : 1))); p.atk = null; }
      setCd(T.charges ? 0.55 : 1); announce(); break;
    }
    case 'machwire': {
      const dir = p.facing;
      for (const f of foesNear(w, p.x + dir * w.arena.w / 2, w.arena.w)) {
        if (sign(f.x - p.x) === dir) damageFoe(w, f, strike(T.dmg, { vx: 140, vy: -120 }));
      }
      if (T.trail) w.zones.push({ type: 'snare', x: p.x + dir * 200, r: 180, t: T.trail, stun: 0.6 });
      p.x = clamp(p.x + dir * 420, 20, w.arena.w - 20);
      p.iframes = Math.max(p.iframes, 0.2);
      setCd(); announce(); break;
    }
    case 'overclock': p.overclockT = T.dur; p.overclockExt = T.extendOnHit || 0; setCd(); announce(); break;
    case 'staticsnare':
      w.zones.push({ type: 'snare', x: p.x + p.facing * 60, r: T.r, t: T.dur, stun: T.stun, vuln: T.vuln });
      setCd(); announce(); break;
    case 'cheapshot': {
      const f = nearestFoe(w, (o) => o.state === 'tell' && sign(o.x - p.x) === p.facing, 280);
      p.iframes = Math.max(p.iframes, 0.15);
      if (f) {
        p.x = f.x - p.facing * 44;
        f.state = 'hurt'; f.stateT = 0.5;
        damageFoe(w, f, strike(T.dmg, { vx: 260, vy: -180 }, { hitstop: 0.1 }));
        w.events.push({ t: 'interrupt', x: f.x, y: f.y - f.h });
        if (T.overclock) p.overclockT = Math.max(p.overclockT, T.overclock);
      } else { p.vx = p.facing * 420; p.hurtT = T.whiff; }
      setCd(); announce(); break;
    }
    case 'flashbulb':
      for (const f of foesNear(w, p.x, T.r)) {
        if (!f.flashed) { f.flashed = true; f.state = 'hurt'; f.stateT = T.flinch; damageFoe(w, f, strike(4, { vx: 60, vy: 0 })); }
      }
      setCd(); announce(); break;
    case 'pistonjab': {
      const f = nearestFoe(w, null, 110);
      if (f) {
        p.jabs = (p.jabs || 0) + 1;
        damageFoe(w, f, strike(T.dmg, T.launch3 && p.jabs % 3 === 0 ? { vx: 60, vy: -560 } : { vx: 80, vy: 0 }, { launch: T.launch3 && p.jabs % 3 === 0 }));
      }
      setCd(); announce(); break;
    }
    case 'jamsignal': {
      const targets = T.r ? foesNear(w, p.x, T.r + 200).filter((f) => f.state === 'tell') : [nearestFoe(w, (o) => o.state === 'tell', 320)].filter(Boolean);
      for (const f of targets) {
        f.state = 'hurt'; f.stateT = T.stag;
        if (T.lockout) f.jamT = T.lockout;
        w.events.push({ t: 'interrupt', x: f.x, y: f.y - f.h });
      }
      setCd(targets.length ? 1 : 0.4); announce(); break;
    }
    case 'ghostwire': {
      const f = nearestFoe(w, null, 340);
      if (f) {
        damageFoe(w, f, strike(T.dmg));
        p.x = clamp(f.x + sign(f.x - p.x) * 70, 20, w.arena.w - 20);
        p.facing = -sign(f.x - p.x) || 1;
        if (T.iframes) p.iframes = Math.max(p.iframes, 0.25);
        if (T.chainload) p.atk = null;
      }
      setCd(); announce(); break;
    }
    case 'livewire': p.livewireT = T.dur; p.livewireDmg = T.dmg; p.livewireChip = T.chip; setCd(); announce(); break;
    case 'blownfuse':
      for (const f of foesNear(w, p.x, T.r)) damageFoe(w, f, strike(T.dmg, { vx: 340, vy: -320 }, { launch: true, hitstop: 0.1 }));
      hitPylons(w, { dmg: T.dmg }, p.x - T.r, GROUND_Y - 80, T.r * 2, 90);
      p.hurtT = T.selfstun;
      w.events.push({ t: 'rupture', x: p.x, y: p.y });
      setCd(); announce(); break;

    // -------- RAIN --------
    case 'payback': p.parryT = T.win; p.parryTier = mv.tier; setCd(); announce(); break;
    case 'mirrorveil': p.veilT = T.dur; setCd(); announce(); break;
    case 'umbrella': {
      p.guardT = T.dur; p.guardTier = mv.tier;
      const rushed = w.t - p.guardLastT < 6;
      p.guardLastT = w.t;
      setCd(rushed ? 2 : 1); announce(); break;
    }
    case 'stormnap': p.napT = T.chan; p.napChan = T.chan; p.napHeal = T.heal; p.napTier = mv.tier; setCd(); announce(); break;
    case 'leechburr': {
      const f = nearestFoe(w, null, 300);
      if (f) { f.burr = { drip: T.drip, hops: !!T.hops }; setCd(); announce(); }
      else setCd(0.3);
      break;
    }
    case 'siphonfang': p.siphonT = T.dur; p.siphonSteal = T.steal; setCd(); announce(); break;
    case 'litterdecoy':
      p.hp = Math.max(1, p.hp - Math.round(p.maxHp * T.cost));
      w.decoy = { x: p.x - p.facing * 40, hp: 30, t: T.dur, boom: T.boom || 0 };
      p.iframes = Math.max(p.iframes, 1);
      setCd(); announce(); break;
    case 'brokenrecord': {
      const f = nearestFoe(w, null, 320);
      if (f) { f.encoreN = T.n; if (T.slowed) f.slowedT = 6; setCd(); announce(); }
      else setCd(0.3);
      break;
    }
    case 'glassward':
      w.panes.push({ x: p.x + p.facing * 90, w: T.w, t: T.dur, shock: T.shock || 0 });
      setCd(); announce(); break;
    case 'vortex': {
      const cx = p.x + p.facing * 140;
      w.zones.push({ type: 'vortex', x: cx, r: T.r, t: T.hold, vuln: T.vuln });
      setCd(); announce(); break;
    }
    case 'straysgrit': p.endureT = T.dur; p.endureSurge = !!T.surge; p.endured = false; setCd(); announce(); break;
    case 'hoardhurl': {
      if (p.stacks <= 0) { setCd(0.2); break; }
      const n = p.stacks; p.stacks = 0;
      for (const f of foesNear(w, p.x, 200)) damageFoe(w, f, strike(T.per * n, T.launch && n >= p.stackMax ? { vx: 120, vy: -520 } : { vx: 260, vy: -80 }, { launch: T.launch && n >= p.stackMax }));
      setCd(); announce(); break;
    }
    case 'cloudburst': p.cbT = T.dur; p.cbCdr = T.cdr; p.cbTrickle = T.trickle; setCd(); announce(); break;

    // -------- RUST --------
    case 'whetstone': p.napT = 0; p.hurtT = T.chan; p.whetHits = T.hits; p.whetMult = T.mult; setCd(); announce(); break;
    case 'scrapplating': p.platingT = T.dur; p.platDr = T.dr; p.platSlow = T.slow; p.platThorns = !!T.thorns; setCd(); announce(); break;
    case 'grudgecoil': p.bide = { t: 2, stored: 0, mult: T.mult, launch: !!T.launch }; setCd(); announce(); break;
    case 'rustveil':
      p.furyOn = !p.furyOn;
      if (!p.furyOn && mv.tier < 2) p.furyStacks = 0;
      p.furyPer = T.per; p.furyMax = T.max;
      setCd(0.15); announce(); break;
    case 'undergrate': p.digT = T.dur; p.digDmg = T.dmg; p.digBreak = !!T.armorbreak; setCd(); announce(); break;
    case 'rupture':
      for (const f of foesNear(w, p.x, T.r)) {
        if (!f.onGround) continue;
        damageFoe(w, f, strike(T.dmg, { vx: 120, vy: -420 }, { launch: true }));
        if (T.slow) f.slowedT = 3;
      }
      for (const py of w.pylons) {
        if (py.hp > 0 && Math.abs(py.x - p.x) < T.r) {
          py.hp -= T.dmg;
          w.events.push({ t: 'pylon_hit', x: py.x, y: GROUND_Y - 40, dmg: T.dmg });
          if (py.hp <= 0) w.events.push({ t: 'pylon_down', x: py.x, y: GROUND_Y - 40 });
        }
      }
      if (T.rubble) w.zones.push({ type: 'caltrops', x: p.x + p.facing * 150, r: 100, t: 5, tick: 4 });
      p.hurtT = 0.22;
      w.events.push({ t: 'rupture', x: p.x, y: p.y });
      setCd(); announce(); break;
    case 'heldbreath': p.focus = { t: T.chan, dmg: T.dmg, aoe: !!T.aoe, lateArmor: !!T.lateArmor }; setCd(); announce(); break;
    case 'caltrops': {
      const n = T.patches || 1;
      for (let i = 0; i < n; i++) w.zones.push({ type: 'caltrops', x: p.x + p.facing * (120 + i * 180), r: T.r, t: T.dur, tick: T.tick });
      setCd(); announce(); break;
    }
    case 'rustscreech':
      for (const f of foesNear(w, p.x + p.facing * T.r * 0.5, T.r)) { f.vulnT = T.dur; f.vulnMult = T.vuln; }
      setCd(); announce(); break;
    case 'junkroll': p.rollT = T.dur; p.rollDmg = T.dmg; p.rollRamp = T.ramp; p.rollHits = 0; p.rollLaunch = !!T.finLaunch; setCd(); announce(); break;
    case 'coldreceipt': {
      const doubled = p.hitSinceAtk || (T.alsoPerfect && w.t - (p.lastPerfectT || -99) < 3);
      const f = nearestFoe(w, null, 130);
      if (f) damageFoe(w, f, strike(T.dmg * (doubled ? T.mult : 1), { vx: 340, vy: -160 }, { hitstop: doubled ? 0.12 : 0.06 }));
      p.hitSinceAtk = false;
      setCd(); announce(); break;
    }

    // -------- MOON --------
    case 'zerog': p.zgT = T.dur; p.zgAirDmg = T.airDmg; p.zgFloat = !!T.floatFoes; p.jumps = Math.max(p.jumps, T.jumps); setCd(); announce(); break;
    case 'moonhop':
      p.hopT = 0.001; p.hopDef = T;
      p.vy = -980; p.onGround = false; p.iframes = 0.35;
      setCd(); announce(); break;
    case 'curfewbell': w.curfewT = T.dur; w.curfewSlow = T.slow; w.curfewPop = !!T.popcorn; setCd(); announce(); break;
    case 'lullaby':
      for (const f of foesNear(w, p.x, T.r)) { f.sleepMarkT = T.delay; f.sleepDur = T.dur; f.sleepCrit = !!T.crit; }
      setCd(); announce(); break;
    case 'lastaria':
      for (const f of w.foes) if (!f.dead) { f.ariaT = T.win; f.ariaTag = false; f.ariaDmg = T.dmg; if (T.slowTag) f.slowedT = T.win; }
      setCd(); announce(); break;

    // -------- wildcards --------
    case 'luckypaw': {
      const ids = Object.keys(MOVES).filter((k) => !MOVES[k].gated && k !== 'luckypaw');
      const pick = ids[(w.rng() * ids.length) | 0];
      const saved = p.moves[slot];
      p.moves[slot] = { id: pick, tier: 1 };
      p.cds[slot] = 0;
      useMove(w, slot);
      p.moves[slot] = saved;
      p.cds[slot] = MOVES.luckypaw.cd;
      break;
    }
    case 'afterimage': p.aiT = T.dur; setCd(); announce(); break;
    case 'feralpact':
      p.hp = Math.max(1, p.hp - Math.round(p.hp * T.cost));
      p.pactMult = T.mult;
      setCd(); announce(); break;
  }
}

// ---------- player step ----------
function startAttack(w, key) {
  const p = w.player;
  p.atk = { def: ATTACKS[key], key, t: 0, struck: new Set() };
  p.hitSinceAtk = false;
  w.events.push({ t: 'swing', big: key === 'c3' || key === 'launcher' });
}
function bufferAction(p, action, t) {
  p.buffer.push({ action, t });
  if (p.buffer.length > 8) p.buffer.shift();
}
function consume(p, action, now) {
  for (let i = p.buffer.length - 1; i >= 0; i--) {
    if (p.buffer[i].action === action && now - p.buffer[i].t <= BUFFER) {
      p.buffer.splice(i, 1);
      return true;
    }
  }
  return false;
}

function atkSpeed(p) { return p.overclockT > 0 ? 1.4 : 1; }
function moveSpeed(p) {
  return MOVE_SPD * p.spdMult * (p.overclockT > 0 ? 1.4 : 1) * (p.platingT > 0 ? 1 - p.platSlow : 1);
}

function stepPlayer(w, dt, input) {
  const p = w.player;
  p.animT += dt;
  p.iframes = Math.max(0, p.iframes - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.guardT = Math.max(0, p.guardT - dt);
  p.parryT = Math.max(0, p.parryT - dt);
  p.veilT = Math.max(0, p.veilT - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.overclockT = Math.max(0, p.overclockT - dt);
  p.livewireT = Math.max(0, p.livewireT - dt);
  p.siphonT = Math.max(0, p.siphonT - dt);
  p.platingT = Math.max(0, p.platingT - dt);
  p.zgT = Math.max(0, p.zgT - dt);
  p.aiT = Math.max(0, p.aiT - dt);
  p.endureT = Math.max(0, p.endureT - dt);
  p.comboT -= dt; if (p.comboT <= 0) p.combo = 0;
  for (let i = 0; i < 3; i++) p.cds[i] = Math.max(0, p.cds[i] - dt);
  if (p.cbT > 0) { p.cbT -= dt; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * p.cbTrickle * dt); }

  // channels
  if (p.napT > 0) {
    p.napT -= dt;
    if (p.napT <= 0) {
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * p.napHeal));
      if (p.napTier >= 2) { /* also clears debuffs — none yet stick to the player */ }
      w.events.push({ t: 'heal', amt: Math.round(p.maxHp * p.napHeal), x: p.x, y: p.y - 50 });
    }
    return; // fully vulnerable, fully committed
  }
  if (p.bide) {
    p.bide.t -= dt;
    if (p.bide.t <= 0) {
      const b = p.bide; p.bide = null;
      for (const f of foesNear(w, p.x, 220)) {
        damageFoe(w, f, { dmg: Math.max(6, Math.round(b.stored * b.mult)), kb: { vx: 300, vy: b.launch ? -420 : -100 }, hitstop: 0.1, launch: b.launch }, 1, { raw: true });
      }
      w.events.push({ t: 'rupture', x: p.x, y: p.y });
    }
  }
  if (p.focus) {
    p.focus.t -= dt;
    if (p.focus.lateArmor && p.focus.t < 0.3) p.iframes = Math.max(p.iframes, 0.05);
    if (p.focus.t <= 0) {
      const F = p.focus; p.focus = null;
      const targets = F.aoe ? foesNear(w, p.x + p.facing * 90, 140) : [nearestFoe(w, null, 130)].filter(Boolean);
      for (const f of targets) damageFoe(w, f, { dmg: F.dmg, kb: { vx: 420, vy: -260 }, hitstop: 0.14, launch: true });
      w.events.push({ t: 'rupture', x: p.x, y: p.y });
    }
  }
  if (p.hopT > 0) {
    // moonhop: hover at apex, slam on landing (handled in stepGravity)
    if (p.vy > -60 && p.vy < 60 && p.hopDef.hover) { p.vy = Math.min(p.vy, 0); p.hopT += dt; if (p.hopT < p.hopDef.hover) p.vy = -20; }
  }

  // netted / capture-ball struggle: mash ANY button to break out
  if (p.struggleNeed > 0) {
    const mash = (input.atk ? 1 : 0) + (input.jump ? 1 : 0) + (input.dash ? 1 : 0);
    if (mash) {
      p.struggleNeed -= mash;
      w.events.push({ t: 'struggle', left: p.struggleNeed });
      if (p.struggleNeed <= 0) {
        p.struggleNeed = 0;
        p.iframes = 1.0;
        w.events.push({ t: 'break_free', x: p.x, y: p.y - 50 });
      }
    }
    p.struggleTick = (p.struggleTick || 0) + dt;
    if (p.struggleTick > 0.9) { p.struggleTick = 0; p.hp = Math.max(1, p.hp - 2); }
    return;
  }
  if (p.rootT > 0) {
    p.rootT -= dt;
    const mash = (input.atk ? 1 : 0) + (input.jump ? 1 : 0) + (input.dash ? 1 : 0);
    if (mash) p.rootT -= 0.18 * mash;
    return;
  }

  // buffered edges
  if (input.atk) bufferAction(p, 'atk', w.t);
  if (input.jump) bufferAction(p, 'jump', w.t);
  if (input.dash) bufferAction(p, 'dash', w.t);
  if (input.ab1) useMove(w, 0);
  if (input.ab2) useMove(w, 1);
  if (input.ab3) useMove(w, 2);

  // undergrate: beneath the pavement
  if (p.digT > 0) {
    p.digT -= dt;
    p.x += input.mx * moveSpeed(p) * 1.2 * dt;
    p.x = clamp(p.x, 20, w.arena.w - 20);
    if (p.digT <= 0) {
      for (const f of foesNear(w, p.x, 90)) damageFoe(w, f, { dmg: p.digDmg, kb: { vx: 80, vy: -640 }, hitstop: 0.1, launch: true });
      w.events.push({ t: 'slam', x: p.x, y: GROUND_Y });
    }
    return;
  }
  // junk roll
  if (p.rollT > 0) {
    p.rollT -= dt;
    const dir = input.mx !== 0 ? sign(input.mx) : p.facing;
    p.facing = dir;
    p.x = clamp(p.x + dir * 520 * dt, 20, w.arena.w - 20);
    for (const f of foesNear(w, p.x, 50)) {
      if (!f._rolled || w.t - f._rolled > 0.4) {
        f._rolled = w.t;
        p.rollHits++;
        damageFoe(w, f, { dmg: p.rollDmg * (1 + p.rollRamp * p.rollHits), kb: { vx: 240, vy: -160 }, hitstop: 0.05 });
      }
    }
    if (p.rollT <= 0 && p.rollLaunch) {
      for (const f of foesNear(w, p.x, 90)) damageFoe(w, f, { dmg: 8, kb: { vx: 120, vy: -520 }, hitstop: 0.08, launch: true });
    }
    return;
  }

  // dash-dodge
  if (p.hurtT <= 0 && p.dashCd <= 0 && consume(p, 'dash', w.t)) {
    p.dashT = 0.28;
    p.dashDir = input.mx !== 0 ? sign(input.mx) : p.facing;
    p.dashCd = 0.55;
    p.iframes = Math.max(p.iframes, 0.14);
    p.atk = null; p.diving = false;
    w.events.push({ t: 'dash', x: p.x, y: p.y - 20 });
  }
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDir * 620;
    p.x = clamp(p.x + p.vx * dt, 20, w.arena.w - 20);
    // Live Wire: damaging dashes
    if (p.livewireT > 0) {
      for (const f of foesNear(w, p.x, 46)) {
        if (!f._lw || w.t - f._lw > 0.3) {
          f._lw = w.t;
          damageFoe(w, f, { dmg: p.livewireDmg, kb: { vx: 160, vy: -80 }, hitstop: 0.04 });
          p.hp = Math.max(1, p.hp - Math.round(p.maxHp * p.livewireChip));
        }
      }
    }
    if (!p.onGround) stepGravity(p, dt, w);
    return;
  }

  if (p.hurtT > 0) {
    p.x += p.vx * dt;
    p.vx *= Math.pow(0.001, dt);
    stepGravity(p, dt, w);
    p.x = clamp(p.x, 20, w.arena.w - 20);
    return;
  }

  // attack in progress
  if (p.atk) {
    const a = p.atk;
    a.t += dt * atkSpeed(p);
    const d = a.def;
    if (a.t >= d.startup && a.t <= d.startup + d.active) {
      const [hx, hy, hw, hh] = playerHitbox(p, d);
      for (const f of w.foes) {
        if (f.dead || a.struck.has(f)) continue;
        const [fx, fy, fw, fh] = foeHurtbox(f);
        if (rectsHit(hx, hy, hw, hh, fx, fy, fw, fh)) {
          a.struck.add(f);
          damageFoe(w, f, d);
          if (p.overclockExt) p.overclockT += p.overclockExt;
        }
      }
      if (w.decoy === null || true) { /* decoys don't block your own hits */ }
      if (!a.pylonsHit) { a.pylonsHit = true; hitPylons(w, d, hx, hy, hw, hh); }
    }
    const total = d.startup + d.active + d.recovery;
    if (a.hit && a.t >= d.startup && consume(p, 'jump', w.t)) {
      p.atk = null;
      if (p.onGround || p.coyoteT > 0) { p.vy = JUMP_VY; p.onGround = false; p.jumps = p.maxJumps - 1; }
      else if (p.jumps > 0) { p.vy = DJUMP_VY; p.jumps--; }
      w.events.push({ t: 'jump', cancel: true });
      return;
    }
    if (d.next && a.t >= (d.cancelFrom || total) && consume(p, 'atk', w.t)) {
      startAttack(w, input.my < -0.5 ? 'launcher' : d.next);
    } else if (a.t >= total) {
      p.atk = null;
    }
    if (d.air || !p.onGround) stepGravity(p, dt, w);
    else p.x += p.facing * 30 * dt;
    p.x = clamp(p.x, 20, w.arena.w - 20);
    if (!p.atk) p.state = 'idle';
    return;
  }

  // movement
  p.vx = input.mx * moveSpeed(p);
  if (input.mx !== 0) p.facing = sign(input.mx);
  p.x += p.vx * dt;
  p.x = clamp(p.x, 20, w.arena.w - 20);
  // chase barriers are solid until smashed
  for (const py of w.pylons) {
    if (py.barrier && py.hp > 0 && p.x > py.x - 30 && p.x < py.x + 30) {
      p.x = p.x < py.x ? py.x - 30 : py.x + 30;
    }
  }

  const canGroundJump = p.onGround || p.coyoteT > 0;
  if (consume(p, 'jump', w.t)) {
    if (canGroundJump) {
      p.vy = JUMP_VY; p.onGround = false; p.coyoteT = 0; p.jumps = p.maxJumps - 1;
      w.events.push({ t: 'jump' });
    } else if (p.jumps > 0) {
      p.vy = DJUMP_VY; p.jumps--;
      w.events.push({ t: 'jump', double: true });
    }
  }

  if (!p.onGround && input.my > 0.5 && consume(p, 'atk', w.t)) {
    p.diving = true;
    p.vy = DIVE_VY;
    w.events.push({ t: 'dive' });
  } else if (consume(p, 'atk', w.t)) {
    if (!p.onGround) startAttack(w, 'aerial');
    else if (input.my < -0.5) startAttack(w, 'launcher');
    else startAttack(w, 'c1');
  }

  stepGravity(p, dt, w);
  p.state = p.onGround ? (Math.abs(p.vx) > 20 ? 'run' : 'idle') : 'air';

  // enemy area denial
  for (const z of w.zones) {
    if ((z.type !== 'smog' && z.type !== 'puddle') || Math.abs(p.x - z.x) > z.r || !p.onGround) continue;
    p._dotT = (p._dotT || 0) + dt;
    if (p._dotT > 0.7) {
      p._dotT = 0;
      w.lastThreat = z.type === 'smog' ? 'the smog' : 'gutter sludge';
      hurtPlayer(w, Math.max(2, Math.round((z.dps || 6) * 0.5)), z.x, null);
    }
  }
}

function stepGravity(p, dt, w) {
  if (p.onGround) { p.coyoteT = COYOTE; return; }
  p.coyoteT = Math.max(0, p.coyoteT - dt);
  const g = GRAV * (p.zgT > 0 ? 0.55 : 1);
  p.vy += g * dt;
  p.y += p.vy * dt;
  if (p.y >= GROUND_Y) {
    p.y = GROUND_Y;
    p.onGround = true;
    p.jumps = p.maxJumps;
    p.vy = 0;
    if (p.hopT > 0 && p.hopDef) {
      const T = p.hopDef; p.hopT = 0; p.hopDef = null;
      for (const f of foesNear(w, p.x, T.r)) damageFoe(w, f, { dmg: T.dmg, kb: { vx: 160, vy: T.launch ? -480 : -220 }, hitstop: 0.1, launch: !!T.launch });
      w.events.push({ t: 'slam', x: p.x, y: p.y });
    } else if (p.diving) {
      p.diving = false;
      const d = ATTACKS.divehit;
      for (const f of w.foes) {
        if (!f.dead && Math.abs(f.x - p.x) < 90 && f.onGround) damageFoe(w, f, d);
      }
      hitPylons(w, d, p.x - 90, GROUND_Y - 80, 180, 90);
      w.events.push({ t: 'slam', x: p.x, y: p.y });
    } else {
      w.events.push({ t: 'land', x: p.x, y: p.y });
    }
  }
}

// ---------- foe step ----------
function stepFoe(w, f, dt) {
  const p = w.player;
  const B = BESTIARY[f.species];
  const tempo = (w.curfewT > 0 ? w.curfewSlow : 1) * (f.slowedT > 0 ? 0.6 : 1);
  const edt = dt * tempo;
  f.animT += dt;
  f.hitFlash = Math.max(0, f.hitFlash - dt);
  f.slowedT = Math.max(0, f.slowedT - dt);
  f.vulnT = Math.max(0, f.vulnT - dt);
  if (f.jamT) f.jamT = Math.max(0, f.jamT - dt);

  // marks
  if (f.burr) {
    const drain = f.maxHp * f.burr.drip * dt;
    f.hp -= drain;
    p.hp = Math.min(p.maxHp, p.hp + drain * 0.9);
    if (f.hp <= 0) { killFoe(w, f); return; }
  }
  if (f.sleepMarkT > 0) {
    f.sleepMarkT -= dt;
    if (f.sleepMarkT <= 0) { f.asleepT = f.sleepDur; f.state = 'idle'; w.events.push({ t: 'sleep', x: f.x, y: f.y - f.h }); }
  }
  if (f.ariaT > 0) {
    f.ariaT -= dt;
    if (f.ariaT <= 0 && f.ariaTag) {
      damageFoe(w, f, { dmg: f.ariaDmg, kb: { vx: 200, vy: -240 }, hitstop: 0.08, launch: true }, 1, { raw: true });
      w.events.push({ t: 'interrupt', x: f.x, y: f.y - f.h });
      if (f.dead) return;
    }
  }
  if (f.asleepT > 0) { f.asleepT -= dt; return; }
  if (f.paralyzedT > 0) { f.paralyzedT -= dt; return; }

  // zones affecting foes
  for (const z of w.zones) {
    if (Math.abs(f.x - z.x) > z.r) continue;
    if (z.type === 'snare' && f.onGround) { f.paralyzedT = Math.max(f.paralyzedT, z.stun * dt * 8); if (z.vuln) { f.vulnT = 1; f.vulnMult = z.vuln; } }
    if (z.type === 'caltrops' && f.onGround) {
      f.slowedT = Math.max(f.slowedT, 0.4);
      f._calT = (f._calT || 0) + dt;
      if (f._calT > 1) { f._calT = 0; damageFoe(w, f, { dmg: z.tick, kb: { vx: 0, vy: 0 }, hitstop: 0 }, 1, { raw: true }); if (f.dead) return; }
    }
    if (z.type === 'vortex') {
      f.x += sign(z.x - f.x) * 260 * dt;
      if (z.vuln) { f.vulnT = 0.5; f.vulnMult = z.vuln; }
    }
  }

  // fliers hover unless launched; launched things fall
  if (!f.onGround && !(f.fly && f.state !== 'launched' && f.state !== 'down')) {
    f.vy += GRAV * (p.zgFloat ? 0.6 : 1) * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.x = clamp(f.x, 20, w.arena.w - 20);
    if (f.y >= GROUND_Y) {
      f.y = GROUND_Y; f.onGround = true; f.vy = 0; f.vx = 0; f.juggle = 0;
      f.state = 'down'; f.stateT = f.fly ? 0.9 : 0.5;
      w.events.push({ t: 'foe_land', x: f.x, y: f.y });
    }
    return;
  }
  // fliers drift back up to hover height after being grounded
  if (f.fly && f.onGround && f.state !== 'down') {
    f.onGround = false;
  }
  if (f.fly && f.state !== 'launched' && f.state !== 'down' && f.state !== 'attack') {
    const hoverY = GROUND_Y - f.fly + Math.sin(f.animT * 2.2) * 10;
    f.y += (hoverY - f.y) * Math.min(1, 3 * dt);
  }

  if (f.state === 'hurt') {
    f.stateT -= dt;
    f.x += f.vx * dt;
    f.vx *= Math.pow(0.002, dt);
    f.x = clamp(f.x, 20, w.arena.w - 20);
    if (f.stateT <= 0) { f.state = 'idle'; f.stateT = 0.3; f.vx = 0; }
    return;
  }
  if (f.state === 'down') {
    f.stateT -= dt;
    if (f.stateT <= 0) { f.state = 'idle'; f.stateT = 0.4; }
    return;
  }

  // target: the decoy taunts
  const tx = w.decoy ? w.decoy.x : p.x;
  const dx = tx - f.x;
  const dist = Math.abs(dx);
  f.facing = sign(dx) || f.facing;

  const wantRange = f.species === 'growler' || f.species === 'bloodhound' ? 190
    : B.behavior === 'spit' ? (B.range || 300)
    : B.behavior === 'slam' || B.behavior === 'smog' ? 110
    : B.behavior === 'whip' ? B.whipLen - 20
    : B.behavior === 'toll' ? 260
    : B.behavior === 'static' ? 1e9
    : B.behavior === 'netdrop' ? 30 /* hovers above you */
    : 90;

  if (f.state === 'idle') {
    f.stateT -= edt;
    if (f.stateT <= 0) f.state = B.behavior === 'static' ? 'idle' : 'approach';
    if (B.behavior === 'static') { f.stateT = 1; return; }
  } else if (f.state === 'approach') {
    if (B.behavior === 'netdrop') {
      // hover toward a spot above the player
      f.x += sign(p.x - f.x) * B.walk * tempo * dt;
      if (Math.abs(p.x - f.x) < 40) {
        f.state = 'tell'; f.stateT = B.tell / tempo; f.attackHit = false;
        w.events.push({ t: 'tell', x: f.x, y: f.y - f.h - 10, species: f.species });
      }
    } else if (dist > wantRange) {
      f.x += sign(dx) * B.walk * tempo * dt * (f.frenzyT > 0 ? 1.4 : 1);
      // glass panes shock melee foes crossing them
      for (const pane of w.panes) {
        if (pane.shock && Math.abs(f.x - pane.x) < pane.w / 2 && (!f._paneT || w.t - f._paneT > 1.5)) {
          f._paneT = w.t;
          damageFoe(w, f, { dmg: pane.shock, kb: { vx: -140 * f.facing, vy: 0 }, hitstop: 0.03 }, 1, { raw: true });
          if (f.dead) return;
        }
      }
    } else if (f.encoreN > 0) {
      f.encoreN--;
      f.state = 'attack'; f.stateT = B.attackT;
      f.attackDir = sign(dx) || f.facing;
      f.attackHit = false;
      w.events.push({ t: 'foe_attack', species: f.species });
    } else {
      f.state = 'tell'; f.stateT = (f.boss ? f.boss.tell : B.tell) / tempo;
      f.attackHit = false;
      w.events.push({ t: 'tell', x: f.x, y: f.y - f.h - 10, species: f.species });
    }
  } else if (f.state === 'tell') {
    f.stateT -= edt;
    if (f.stateT <= 0) {
      f.state = 'attack'; f.stateT = B.attackT;
      f.attackDir = sign(dx) || f.facing;
      f.pattern = (f.pattern || 0) + 1;
      w.events.push({ t: 'foe_attack', species: f.species });
    }
  } else if (f.state === 'attack') {
    f.stateT -= dt;
    const beh = B.behavior;
    const foeDmg = f.dmgOver || (f.boss ? f.boss.dmg : B.dmg);
    if (beh === 'spit' && !f.attackHit) {
      // one arcing glob at the player's position
      f.attackHit = true;
      const dxs = p.x - f.x;
      w.eshots.push({ x: f.x + f.facing * 14, y: f.y - f.h + 6, vx: dxs * 1.1, vy: -420, grav: 900, type: 'spit', dmg: foeDmg, from: f });
      w.events.push({ t: 'eshoot', x: f.x, y: f.y - f.h });
    } else if (beh === 'whip' && !f.attackHit) {
      f.attackHit = true;
      const reach = B.whipLen;
      if (Math.abs(p.x - f.x) < reach && sign(p.x - f.x) === f.facing && p.y > GROUND_Y - 70) {
        if (p.iframes > 0 && p.dashT > 0) { markPerfect(w, f); }
        else {
          w.lastThreat = `${B.name}'s tape-snare`;
          if (hurtPlayer(w, foeDmg, f.x, f)) { p.rootT = B.rootT; w.events.push({ t: 'rooted' }); }
        }
      }
    } else if (beh === 'slam' && !f.attackHit) {
      f.attackHit = true;
      if (Math.abs(p.x - f.x) < B.slamR && p.onGround) {
        if (p.iframes > 0 && p.dashT > 0) markPerfect(w, f);
        else { w.lastThreat = `${B.name}'s slab-slam`; hurtPlayer(w, foeDmg, f.x, f); }
      }
      w.events.push({ t: 'slam', x: f.x, y: GROUND_Y });
    } else if (beh === 'smog' && !f.attackHit) {
      f.attackHit = true;
      w.zones.push({ type: 'smog', x: f.x + f.facing * 70, r: B.smogR, t: B.smogT, dps: foeDmg });
      w.events.push({ t: 'eshoot', x: f.x, y: f.y - f.h });
    } else if (beh === 'toll' && !f.attackHit) {
      f.attackHit = true;
      for (const o of w.foes) if (o !== f && !o.dead) o.frenzyT = B.buffT;
      w.tollT = B.buffT;
      w.events.push({ t: 'toll', x: f.x, y: f.y - f.h });
    } else if (beh === 'netdrop' && !f.attackHit) {
      f.attackHit = true;
      w.eshots.push({ x: f.x, y: f.y, vx: 0, vy: 320, grav: 500, type: 'net', dmg: 4, rootT: 1.6 });
      w.events.push({ t: 'eshoot', x: f.x, y: f.y });
    } else if (beh === 'royal' && !f.attackHit && f.pattern === 1) {
      // REGENT's leap-slam
      f.attackHit = true;
      if (Math.abs(p.x - f.x) < 130 && p.onGround) {
        if (p.iframes > 0 && p.dashT > 0) markPerfect(w, f);
        else { w.lastThreat = 'REGENT'; hurtPlayer(w, foeDmg, f.x, f); }
      }
      w.events.push({ t: 'slam', x: f.x, y: GROUND_Y });
    } else if (beh === 'leash' && !f.attackHit) {
      // the Keeper's whip: sweep (low — jump it) / crack (dash through) / grab-pull
      const pat = f.pattern % 3;
      const reach = 240;
      const inReach = Math.abs(p.x - f.x) < reach && sign(p.x - f.x) === f.facing;
      f.attackHit = true;
      if (inReach) {
        const dodged = p.iframes > 0 && p.dashT > 0;
        const jumped = pat === 0 && p.y < GROUND_Y - 50;
        if (dodged) markPerfect(w, f);
        else if (jumped) { /* the sweep passes under you */ }
        else {
          w.lastThreat = 'the Leash';
          if (pat === 2) { p.x = f.x + f.facing * -70; } // grab-pull drags you in
          hurtPlayer(w, foeDmg, f.x, f);
        }
      }
      w.events.push({ t: 'whipcrack', x: f.x + f.facing * 120, y: GROUND_Y - 40, pat });
    } else {
      // charging behaviors: rush / dive / peck / drift / royal fan
      f.x += f.attackDir * (B.attackV || 300) * tempo * dt;
      f.x = clamp(f.x, 20, w.arena.w - 20);
      if (beh === 'dive') {
        // plunge toward the ground line
        f.y = Math.min(GROUND_Y, f.y + 620 * dt);
      }
      if (w.decoy && Math.abs(f.x - w.decoy.x) < 40) {
        w.decoy.hp -= 10;
        f.state = 'recover'; f.stateT = B.recover;
      } else if (!f.attackHit) {
        const [fx, fy, fw, fh] = foeHurtbox(f);
        const [px, py, pw, ph] = playerHurtbox(p);
        if (rectsHit(fx, fy, fw, fh, px, py, pw, ph) && (beh === 'dive' || p.y > GROUND_Y - 60)) {
          if (p.iframes > 0 && p.dashT > 0) markPerfect(w, f);
          else {
            w.lastThreat = f.boss ? `${f.boss.name}` : `${B.name}'s ${beh === 'dive' ? 'dive' : beh === 'peck' ? 'beak' : 'lunge'}`;
            if (hurtPlayer(w, foeDmg, f.x, f)) f.attackHit = true;
          }
        }
      }
    }
    if (f.stateT <= 0) {
      f.state = 'recover'; f.stateT = B.recover; f.pdodged = false;
      if (f.fly) f.onGround = false;
    }
  } else if (f.state === 'recover') {
    f.stateT -= edt;
    if (f.stateT <= 0) { f.state = 'idle'; f.stateT = 0.3 + w.rng() * 0.8; }
  }
}

// ---------- enemy & gadget projectiles ----------
function stepEshots(w, dt) {
  const p = w.player;
  for (let i = w.eshots.length - 1; i >= 0; i--) {
    const e = w.eshots[i];
    e.vy += (e.grav || 0) * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    let dead = false;
    // smashable mid-air by the player's active attack
    if (e.smashable !== false && p.atk) {
      const a = p.atk;
      if (a.t >= a.def.startup && a.t <= a.def.startup + a.def.active) {
        const [hx, hy, hw, hh] = playerHitbox(p, a.def);
        if (rectsHit(hx, hy, hw, hh, e.x - 10, e.y - 10, 20, 20)) {
          dead = true;
          w.events.push({ t: 'smashed', x: e.x, y: e.y, kind: e.type });
        }
      }
    }
    // hit the player
    if (!dead && rectsHit(e.x - 9, e.y - 9, 18, 18, p.x - p.w / 2, p.y - p.h, p.w, p.h)) {
      dead = true;
      if (e.type === 'ball') {
        if (p.iframes <= 0 && p.guardT <= 0) {
          p.struggleNeed = e.need || 6;
          w.lastThreat = 'the capture ball';
          w.events.push({ t: 'balled', x: p.x, y: p.y - 40, need: p.struggleNeed });
        } else w.events.push({ t: 'blocked', x: p.x, y: p.y - 50 });
      } else if (e.type === 'net') {
        if (p.iframes <= 0 && p.guardT <= 0) {
          w.lastThreat = 'a snare net';
          if (hurtPlayer(w, e.dmg || 4, e.x, null)) { p.rootT = e.rootT || 1.6; w.events.push({ t: 'rooted' }); }
        } else w.events.push({ t: 'blocked', x: p.x, y: p.y - 50 });
      } else if (e.type === 'spit') {
        w.lastThreat = 'a gob of gutter-spit';
        hurtPlayer(w, e.dmg, e.x, null);
        w.zones.push({ type: 'puddle', x: e.x, r: 60, t: 4, dps: 6 }); // it splatters regardless
      } else if (e.type === 'potion') {
        dead = false; // potions sail past the player harmlessly
      }
    }
    // land
    if (!dead && e.y >= GROUND_Y - 4) {
      dead = true;
      if (e.type === 'spit') w.zones.push({ type: 'puddle', x: e.x, r: 60, t: 4, dps: 6 });
      if (e.type === 'potion') {
        // heals the hurt-est living hunter monster nearby
        let best = null, worst = 1;
        for (const f of w.foes) {
          if (f.dead) continue;
          const frac = f.hp / f.maxHp;
          if (frac < worst) { worst = frac; best = f; }
        }
        if (best) {
          best.hp = Math.min(best.maxHp, best.hp + Math.round(best.maxHp * (e.heal || 0.2)));
          w.events.push({ t: 'foe_healed', x: best.x, y: best.y - best.h });
        }
      }
      if (e.type === 'ball' || e.type === 'net') w.events.push({ t: 'smashed', x: e.x, y: GROUND_Y, kind: e.type });
    }
    if (dead) w.eshots.splice(i, 1);
  }
}

// ---------- the trainer director ----------
export function startTrainer(w, hunter, act) {
  w.mission = null;
  w.arena = { w: 1200, name: 'the appointment' };
  w.foes.length = 0; w.pylons.length = 0; w.pickups.length = 0;
  w.zones.length = 0; w.panes.length = 0; w.eshots.length = 0; w.decoy = null;
  w.player.x = 140; w.player.y = GROUND_Y;
  w.cam.x = 0;
  w.trainer = {
    def: hunter, act,
    row: hunter.team[act],
    idx: 0, gadgetT: hunter.every, ballT: 0, fledT: 0,
    x: 1140, taunted: false,
  };
  trainerSend(w);
  w.events.push({ t: 'trainer_start', name: hunter.name, line: hunter.intro });
}

function trainerSend(w) {
  const tr = w.trainer;
  const n = tr.def.twins ? 2 : 1;
  for (let i = 0; i < n && tr.idx < tr.row.length; i++) {
    const m = tr.row[tr.idx++];
    const f = mkFoe(w, m.s, tr.x - 120 - i * 70, { hp: m.hp, dmg: m.dmg });
    f.fromTrainer = true;
    w.events.push({ t: 'trainer_send', species: m.s });
  }
}

function stepTrainer(w, dt) {
  const tr = w.trainer;
  if (!tr || tr.fledT > 0) {
    if (tr && tr.fledT > 0) {
      tr.fledT -= dt;
      if (tr.fledT <= 0) w.events.push({ t: 'trainer_gone' });
    }
    return;
  }
  const alive = w.foes.filter((f) => !f.dead && f.fromTrainer);
  const sentAll = tr.idx >= tr.row.length;
  // overlap: next send when the current one is at ≤30%
  if (!sentAll && (alive.length === 0 || alive.every((f) => f.hp <= f.maxHp * 0.3))) {
    trainerSend(w);
    if (!tr.taunted) { tr.taunted = true; w.events.push({ t: 'trainer_line', line: tr.def.taunt }); }
  }
  if (sentAll && alive.length === 0) {
    tr.fledT = 1.4;
    w.events.push({ t: 'trainer_fled', line: tr.def.flee });
    return;
  }
  // gadgets between sends
  tr.gadgetT -= dt;
  if (tr.gadgetT <= 0 && alive.length) {
    tr.gadgetT = tr.def.every;
    throwGadget(w, tr.def.gadget, tr.x);
  }
  // capture balls once the last monster is out — Pursuit 5 (Marked): from the FIRST.
  if ((sentAll || (w.pursuit && w.pursuit.marked)) && alive.length) {
    tr.ballT -= dt;
    if (tr.ballT <= 0) {
      tr.ballT = 9;
      const p = w.player;
      w.eshots.push({ x: tr.x, y: GROUND_Y - 120, vx: (p.x - tr.x) * 0.9, vy: -320, grav: 800, type: 'ball', need: 6 + w.actNum * 2 });
      w.events.push({ t: 'ball_thrown', x: tr.x, y: GROUND_Y - 120 });
    }
  }
}

function throwGadget(w, kind, fromX) {
  const p = w.player;
  if (kind === 'potion') {
    w.eshots.push({ x: fromX, y: GROUND_Y - 130, vx: -240 - w.rng() * 120, vy: -360, grav: 800, type: 'potion', heal: 0.2 });
  } else if (kind === 'net') {
    w.eshots.push({ x: fromX, y: GROUND_Y - 130, vx: (p.x - fromX) * 0.8, vy: -300, grav: 800, type: 'net', dmg: 4, rootT: 1.6 });
  } else if (kind === 'drone') {
    if (w.foes.filter((f) => f.species === 'snaredrone').length < 2) mkFoe(w, 'snaredrone', fromX - 100);
  } else if (kind === 'pylon') {
    if (w.foes.filter((f) => f.species === 'wardpylon').length < 1) mkFoe(w, 'wardpylon', clamp(p.x + 220, 100, w.arena.w - 100));
  } else if (kind === 'reinforce') {
    if (w.foes.length < 7) mkFoe(w, 'tinny', fromX - 80);
  }
  w.events.push({ t: 'gadget', kind, x: fromX });
}

// ---------- THE KEEPER — three phases ----------
export function startKeeper(w, K, starter) {
  w.mission = null;
  w.arena = { w: 1200, name: K.arena };
  w.foes.length = 0; w.pylons.length = 0; w.pickups.length = 0;
  w.zones.length = 0; w.panes.length = 0; w.eshots.length = 0; w.decoy = null;
  w.player.x = 140; w.player.y = GROUND_Y;
  w.cam.x = 0;
  w.keeper = { def: K, starter, phase: 1, sendIdx: 0, gadgetT: 6, ballT: 8, beatDone: false, beatT: 0, shrunk: 0 };
  keeperSend(w);
  w.events.push({ t: 'keeper_start', line: K.lines.intro[starter] || K.lines.intro.snig });
}

function keeperSend(w) {
  const k = w.keeper;
  const e = k.def.phase1.echoes[k.sendIdx++];
  if (e) {
    const f = mkFoe(w, e.s, 900, { hp: e.hp, dmg: e.dmg });
    f.fromTrainer = true;
    w.events.push({ t: 'trainer_send', species: e.s });
  }
}

function stepKeeper(w, dt) {
  const k = w.keeper;
  if (!k) return;
  const p = w.player;
  const alive = w.foes.filter((f) => !f.dead);

  // the scripted beat: the whip lowers
  if (k.beatT > 0) {
    k.beatT -= dt;
    if (k.beatT <= 0) w.events.push({ t: 'keeper_beat_end' });
    return;
  }

  if (k.phase === 1) {
    if (alive.length === 0 || alive.every((f) => f.hp <= f.maxHp * 0.3)) {
      if (k.sendIdx < k.def.phase1.echoes.length) keeperSend(w);
      else if (alive.length === 0) {
        k.phase = 2;
        const R = k.def.phase2.regent;
        const f = mkFoe(w, R.s, 900, { hp: R.hp, dmg: R.dmg });
        f.fromTrainer = true;
        w.boss = f;
        w.events.push({ t: 'keeper_line', line: k.def.lines.phase2 });
      }
    }
  } else if (k.phase === 2) {
    if (alive.length === 0) {
      k.phase = 3;
      const f = mkFoe(w, 'keeper', 950, { hp: k.def.phase3.hp, dmg: k.def.phase3.dmg });
      f.boss = { name: 'THE KEEPER', dmg: k.def.phase3.dmg, tell: BESTIARY.keeper.tell };
      f.fromTrainer = true;
      w.boss = f;
      w.events.push({ t: 'keeper_line', line: k.def.lines.phase3 });
      return;
    }
    k.gadgetT -= dt;
    if (k.gadgetT <= 0) {
      k.gadgetT = k.def.phase2.every;
      throwGadget(w, k.def.phase2.gadgets[(w.rng() * k.def.phase2.gadgets.length) | 0], 1140);
    }
    k.ballT -= dt;
    if (k.ballT <= 0) {
      k.ballT = k.def.phase2.ballEvery;
      w.eshots.push({ x: 1140, y: GROUND_Y - 130, vx: (p.x - 1140) * 0.9, vy: -320, grav: 800, type: 'ball', need: 8 });
      w.events.push({ t: 'ball_thrown', x: 1140, y: GROUND_Y - 130 });
    }
  } else if (k.phase === 3) {
    const boss = w.boss;
    if (!boss || boss.dead) return; // keeper_down handled by killFoe -> boss_down
    const frac = boss.hp / boss.maxHp;
    const shrinks = k.def.phase3.shrinkAt;
    if (k.shrunk < shrinks.length && frac <= shrinks[k.shrunk]) {
      k.shrunk++;
      w.arena.w = Math.max(760, w.arena.w - 200);
      p.x = clamp(p.x, 20, w.arena.w - 20);
      boss.x = clamp(boss.x, 20, w.arena.w - 20);
      w.events.push({ t: 'fence', x: w.arena.w });
    }
    if (!k.beatDone && frac <= k.def.phase3.beatAt) {
      k.beatDone = true;
      k.beatT = 3;
      w.events.push({ t: 'keeper_beat', line: k.def.lines.beat[k.starter] || k.def.lines.beat.snig });
    }
  }
}

function stepCamera(w, dt) {
  const target = clamp(w.player.x - 480, 0, Math.max(0, w.arena.w - 960));
  w.cam.x += (target - w.cam.x) * Math.min(1, 10 * dt);
}

// ---------- main step ----------
export function step(w, dt, input) {
  w.t += dt;
  w.events.length = 0;
  if (w.paused || w.over) return;
  if (w.msgT > 0) { w.msgT -= dt; if (w.msgT <= 0) w.msg = null; }
  w.slowmoT = Math.max(0, w.slowmoT - dt);
  w.curfewT = Math.max(0, w.curfewT - dt);

  // world objects tick
  for (let i = w.zones.length - 1; i >= 0; i--) { w.zones[i].t -= dt; if (w.zones[i].t <= 0) w.zones.splice(i, 1); }
  for (let i = w.panes.length - 1; i >= 0; i--) { w.panes[i].t -= dt; if (w.panes[i].t <= 0) w.panes.splice(i, 1); }
  if (w.decoy) {
    w.decoy.t -= dt;
    if (w.decoy.t <= 0 || w.decoy.hp <= 0) {
      if (w.decoy.boom) for (const f of foesNear(w, w.decoy.x, 120)) damageFoe(w, f, { dmg: w.decoy.boom, kb: { vx: 220, vy: -220 }, hitstop: 0.06, launch: true }, 1, { raw: true });
      w.events.push({ t: 'rupture', x: w.decoy.x, y: GROUND_Y });
      w.decoy = null;
    }
  }

  // the Keeper's beat freezes the fight around the words
  const frozen = w.keeper && w.keeper.beatT > 0;
  stepPlayer(w, dt, input);
  if (!frozen) for (const f of w.foes) if (!f.dead) stepFoe(w, f, dt);
  for (const f of w.foes) if (f.frenzyT) f.frenzyT = Math.max(0, f.frenzyT - dt);
  // safety: a boss dropped to 0 by any path still announces its fall
  if (w.boss && w.boss.hp <= 0 && !w.boss.dead) killFoe(w, w.boss);
  for (let i = w.foes.length - 1; i >= 0; i--) if (w.foes[i].dead) w.foes.splice(i, 1);
  stepEshots(w, dt);
  stepTrainer(w, dt);
  stepKeeper(w, dt);
  // Pursuit 3 — Curfew: linger past 75s in a mission and a Bloodhound joins the hunt.
  if (w.pursuit && w.pursuit.curfew && w.mission && !w.mission.done &&
      w.mission.def.type !== 'chase' && w.t > 75 && !w._curfewHound) {
    w._curfewHound = true;
    mkFoe(w, 'bloodhound', Math.max(60, w.player.x - 400));
    toast(w, 'CURFEW — a Bloodhound is loosed. Finish it.', 2.6);
    w.events.push({ t: 'fence' });
  }
  stepCamera(w, dt);

  const p = w.player;
  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const pk = w.pickups[i];
    if (Math.abs(pk.x - p.x) < 40 && p.y > GROUND_Y - 50) {
      p.hp = Math.min(p.maxHp, p.hp + pk.heal);
      w.events.push({ t: 'heal', amt: pk.heal, x: pk.x, y: GROUND_Y - 30 });
      w.pickups.splice(i, 1);
    }
  }

  if (w.mission && !w.mission.done) {
    const def = w.mission.def;
    if (def.type === 'sabotage') {
      if (w.pylons.every((py) => py.hp <= 0)) {
        w.mission.done = true;
        w.events.push({ t: 'mission_complete' });
      } else if (w.foes.length === 0) {
        w.mission.wave++;
        spawnWave(w);
      }
    } else if (def.type === 'rescue') {
      // pick locks while the waves keep coming
      for (const c of w.cages) {
        if (c.opened) continue;
        if (Math.abs(p.x - c.x) < 70 && p.onGround && p.hurtT <= 0) {
          c.lockT -= dt;
          if (c.lockT <= 0) { c.opened = true; w.events.push({ t: 'cage_open', x: c.x }); }
        }
      }
      if (w.cages.every((c) => c.opened)) {
        w.mission.done = true;
        w.events.push({ t: 'mission_complete' });
      } else if (w.foes.length === 0) {
        w.mission.wave++;
        spawnWave(w);
      }
    } else if (def.type === 'escort') {
      const fr = w.friend;
      if (fr) {
        const danger = w.foes.some((f) => !f.dead && Math.abs(f.x - fr.x) < 260);
        if (!danger) fr.x += fr.speed * dt;
        // scripted ambushes
        for (const [i, at] of [[0, 0.35], [1, 0.7]]) {
          if (!fr.ambushed.includes(i) && fr.x > w.arena.w * at) {
            fr.ambushed.push(i);
            spawnWave(w);
            w.events.push({ t: 'ambush' });
          }
        }
        // foes maul the friend on contact
        for (const f of w.foes) {
          if (!f.dead && f.state === 'attack' && Math.abs(f.x - fr.x) < 40 && (!f._bitFriend || w.t - f._bitFriend > 1)) {
            f._bitFriend = w.t;
            fr.hp -= f.dmgOver || BESTIARY[f.species].dmg;
            w.events.push({ t: 'friend_hurt', x: fr.x, y: fr.y - 40 });
          }
        }
        if (fr.hp <= 0) {
          w.mission.done = true;
          w.events.push({ t: 'mission_failed' });
        } else if (fr.x >= w.arena.w - 70) {
          w.mission.done = true;
          w.events.push({ t: 'mission_complete' });
        }
      }
    } else if (def.type === 'chase') {
      if (p.x >= w.arena.w - 80) {
        w.mission.done = true;
        w.events.push({ t: 'mission_complete' });
      }
    } else if (w.foes.length === 0) {
      w.mission.wave++;
      if (w.mission.wave >= def.waves.length) {
        w.mission.done = true;
        w.events.push({ t: 'mission_complete' });
      } else {
        spawnWave(w);
      }
    }
  }

  if (w.practice && w.foes.length < 2) {
    const species = w.rng() < 0.4 ? 'growler' : 'skitterlin';
    const x = w.player.x > w.arena.w / 2 ? 140 : w.arena.w - 140;
    mkFoe(w, species, x);
    w.events.push({ t: 'spawn', species });
  }
}
