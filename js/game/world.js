// OFF-LEASH — pure combat sim. No DOM, no canvas, no audio, no Math.random.
// Side view: x = across, y = height of feet above nothing (y grows DOWN, ground
// at GROUND_Y). One flat plane + jumps; Smash-lite juggles. Everything lethal
// telegraphs. Deterministic: seeded rng only; events[] drives all feedback.
import { clamp, sign } from '../engine/vec.js';

export const GROUND_Y = 460;
export const GRAV = 2200;
export const MOVE_SPD = 300;
const JUMP_VY = -780;
const DJUMP_VY = -680;
const DIVE_VY = 1400;
const BUFFER = 0.1;   // input buffer window (s)
const COYOTE = 0.08;  // grace to jump after leaving ground

// seeded rng — mulberry32 (KB recipe); the ONLY randomness in the sim
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
// hb offsets are from the entity's feet point, facing right (mirrored on left)
export const ATTACKS = {
  c1: { startup: 0.07, active: 0.10, recovery: 0.12, hb: { ox: 18, oy: -44, w: 44, h: 34 }, dmg: 8, kb: { vx: 120, vy: 0 }, hitstop: 0.04, next: 'c2', cancelFrom: 0.14, anim: 'atk0' },
  c2: { startup: 0.06, active: 0.10, recovery: 0.12, hb: { ox: 20, oy: -46, w: 46, h: 36 }, dmg: 9, kb: { vx: 150, vy: 0 }, hitstop: 0.045, next: 'c3', cancelFrom: 0.14, anim: 'atk1' },
  c3: { startup: 0.10, active: 0.12, recovery: 0.20, hb: { ox: 22, oy: -48, w: 52, h: 40 }, dmg: 14, kb: { vx: 380, vy: -140 }, hitstop: 0.08, next: null, anim: 'atk1' },
  launcher: { startup: 0.11, active: 0.12, recovery: 0.24, hb: { ox: 14, oy: -60, w: 44, h: 56 }, dmg: 10, kb: { vx: 40, vy: -720 }, hitstop: 0.08, launch: true, anim: 'atkUp' },
  aerial: { startup: 0.06, active: 0.11, recovery: 0.12, hb: { ox: 16, oy: -46, w: 46, h: 40 }, dmg: 9, kb: { vx: 110, vy: -160 }, hitstop: 0.05, air: true, anim: 'air' },
  divehit: { startup: 0, active: 0.10, recovery: 0.18, hb: { ox: -40, oy: -20, w: 80, h: 30 }, dmg: 13, kb: { vx: 160, vy: -300 }, hitstop: 0.09, launch: true, anim: 'air' },
};

// ---------- SNIG base kit (M1 — the full 43-move pool lands in M3) ----------
export const KIT = [
  { id: 'umbrella', name: 'Umbrella Guard', cd: 4, essence: 'rain' },
  { id: 'cheapshot', name: 'Cheap Shot', cd: 6, essence: 'static' },
  { id: 'rupture', name: 'Mains Rupture', cd: 9, essence: 'rust' },
];

// ---------- bestiary (M1 slice) ----------
export const BESTIARY = {
  skitterlin: {
    name: 'Skitterlin', hp: 18, dmg: 6, w: 30, h: 26, walk: 150,
    tell: 0.3, attackT: 0.28, attackV: 420, recover: 0.7, essence: 'static',
    hb: { ox: 4, oy: -22, w: 30, h: 22 },
  },
  growler: {
    name: 'Growler', hp: 55, dmg: 12, w: 44, h: 38, walk: 105,
    tell: 0.55, attackT: 0.34, attackV: 640, recover: 0.95, essence: 'rust',
    hb: { ox: 6, oy: -34, w: 44, h: 32 },
  },
};

export function mkPlayer() {
  return {
    kind: 'player', species: 'snig',
    x: 200, y: GROUND_Y, vx: 0, vy: 0, w: 34, h: 40,
    facing: 1, onGround: true, jumps: 2, coyoteT: 0,
    hp: 100, maxHp: 100,
    state: 'idle', animT: 0,
    atk: null,               // {def, key, t, struck:Set}
    dashT: 0, dashDir: 1, dashCd: 0,
    diving: false,
    hurtT: 0, iframes: 0,
    guardT: 0, guardCd: 0, guardLastT: -99, // Umbrella Guard
    cds: [0, 0, 0],
    buffer: [],              // [{action, t}]
    pdodges: 0, combo: 0, comboT: 0,
  };
}

function mkFoe(w, species, x) {
  const B = BESTIARY[species];
  const f = {
    kind: 'foe', species,
    x, y: GROUND_Y, vx: 0, vy: 0, w: B.w, h: B.h,
    facing: -1, onGround: true,
    hp: B.hp, maxHp: B.hp,
    state: 'idle', stateT: 0.4 + w.rng() * 0.6, animT: w.rng() * 10,
    attackHit: false, struck: false,
    hitFlash: 0, juggle: 0,
  };
  w.foes.push(f);
  return f;
}

export function createWorld(seed = 1) {
  const w = {
    t: 0,
    rng: mulberry32(seed),
    arena: { w: 1280, name: 'the practice yard' },
    cam: { x: 0 },
    player: mkPlayer(),
    foes: [],
    pylons: [],              // sabotage objectives {x, hp, maxHp}
    pickups: [],             // {x, y, heal}
    mission: null,           // {def, wave, done}
    boss: null,              // boss entity ref while an act boss lives
    essenceGained: { static: 0, rain: 0, rust: 0, moon: 0 },
    events: [],
    slowmoT: 0,
    msg: null, msgT: 0,
    over: false, overCause: null,
    paused: false,
  };
  return w;
}

// ---------- missions ----------
export function startMission(w, def) {
  w.mission = { def, wave: 0, done: false };
  w.arena = { w: def.arenaW, name: def.arena };
  w.foes.length = 0;
  w.pylons.length = 0;
  w.pickups.length = 0;
  w.player.x = 120;
  w.player.y = GROUND_Y;
  w.player.combo = 0;
  w.cam.x = 0;
  if (def.pylons > 0) {
    for (let i = 0; i < def.pylons; i++) {
      const px = def.arenaW * (0.45 + (i * 0.22));
      w.pylons.push({ x: px, hp: 60, maxHp: 60 });
    }
  }
  spawnWave(w);
  toast(w, `${def.type === 'sabotage' ? 'Smash the pylons' : 'Clear them out'} — ${def.arena}.`, 3.0);
}

function spawnWave(w) {
  const def = w.mission.def;
  const wave = def.waves[w.mission.wave % def.waves.length];
  for (const e of wave) {
    mkFoe(w, e.s, clamp(def.arenaW * e.x, 60, def.arenaW - 60));
  }
  w.events.push({ t: 'wave', n: w.mission.wave + 1 });
}

export function startBoss(w, bossDef) {
  w.mission = null;
  w.arena = { w: 1200, name: bossDef.name };
  w.foes.length = 0;
  w.pylons.length = 0;
  w.pickups.length = 0;
  w.player.x = 140;
  w.player.y = GROUND_Y;
  w.cam.x = 0;
  const f = mkFoe(w, bossDef.species, 900);
  // FLAT authored stats — never scaled off anything
  f.hp = f.maxHp = bossDef.hp;
  f.boss = bossDef;
  f.scale = bossDef.scale;
  f.w *= bossDef.scale; f.h *= bossDef.scale;
  w.boss = f;
  for (const s of bossDef.adds) mkFoe(w, s, 1050 + w.rng() * 100);
  toast(w, `${bossDef.name} bars the way.`, 3.0);
  w.events.push({ t: 'boss_start', name: bossDef.name });
}

// M1 practice-yard spawner: keeps a small crowd alive so feel can be tested forever
export function seedPractice(w) {
  mkFoe(w, 'growler', 700);
  mkFoe(w, 'skitterlin', 950);
  mkFoe(w, 'skitterlin', 1050);
}

function toast(w, text, dur = 2.2) { w.msg = text; w.msgT = dur; }

// ---------- hit resolution ----------
function playerHitbox(p, def) {
  const fx = p.facing;
  const x = fx > 0 ? p.x + def.hb.ox : p.x - def.hb.ox - def.hb.w;
  return [x, p.y + def.hb.oy, def.hb.w, def.hb.h];
}

function foeHurtbox(f) {
  return [f.x - f.w / 2, f.y - f.h, f.w, f.h];
}
function playerHurtbox(p) {
  return [p.x - p.w / 2, p.y - p.h, p.w, p.h];
}

function damageFoe(w, f, def, mul = 1) {
  const p = w.player;
  const dmg = Math.round(def.dmg * mul);
  f.hp -= dmg;
  f.hitFlash = 0.09;
  const dir = sign(f.x - p.x) || p.facing;
  // juggle decay: each air hit scales knockback down so infinites self-terminate
  const jm = 1 / (1 + 0.25 * f.juggle);
  f.vx = def.kb.vx * dir * jm;
  if (def.kb.vy) f.vy = def.kb.vy * jm;
  if (def.launch || (def.kb.vy && def.kb.vy < -200)) {
    f.state = 'launched'; f.onGround = false; f.juggle++;
  } else if (f.onGround && f.state !== 'launched') {
    if (!f.onGround) f.juggle++;
    f.state = 'hurt'; f.stateT = 0.22;
  }
  if (!f.onGround) f.juggle++;
  w.events.push({ t: 'hit', x: f.x, y: f.y - f.h / 2, dmg, big: dmg >= 12, hitstop: def.hitstop });
  if (p.atk) p.atk.hit = true; // hit-confirm: unlocks jump-cancel for juggles
  p.combo++; p.comboT = 1.4;
  if (f.hp <= 0) {
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
      // the streets provide: an occasional dented food can
      if (w.rng() < 0.22) w.pickups.push({ x: f.x, y: GROUND_Y, heal: 12 });
    }
  }
}

// attacks also smash sabotage pylons
function hitPylons(w, def, hx, hy, hw, hh) {
  for (const py of w.pylons) {
    if (py.hp <= 0) continue;
    if (rectsHit(hx, hy, hw, hh, py.x - 18, GROUND_Y - 70, 36, 70)) {
      py.hp -= def.dmg;
      w.events.push({ t: 'pylon_hit', x: py.x, y: GROUND_Y - 40, dmg: def.dmg });
      if (py.hp <= 0) w.events.push({ t: 'pylon_down', x: py.x, y: GROUND_Y - 40 });
    }
  }
}

function hurtPlayer(w, dmg, fromX) {
  const p = w.player;
  if (p.iframes > 0) return false;
  if (p.guardT > 0) {
    w.events.push({ t: 'blocked', x: p.x, y: p.y - 50 });
    return false;
  }
  p.hp -= dmg;
  p.iframes = 0.9;
  p.hurtT = 0.3;
  p.combo = 0;
  p.vx = sign(p.x - fromX) * 220;
  w.events.push({ t: 'player_hurt', x: p.x, y: p.y - 40, dmg });
  if (p.hp <= 0) {
    p.hp = 0;
    w.over = true;
    w.overCause = w.lastThreat || 'the streets';
    w.events.push({ t: 'defeat', cause: w.overCause });
  }
  return true;
}

// ---------- abilities (SNIG base kit) ----------
function useAbility(w, slot) {
  const p = w.player;
  const ab = KIT[slot];
  if (!ab || p.cds[slot] > 0) return;
  if (ab.id === 'umbrella') {
    // Protect: blocks EVERYTHING 0.8s; leaning on it (reuse within 6s) doubles the CD
    p.guardT = 0.8;
    const rushed = w.t - p.guardLastT < 6;
    p.guardLastT = w.t;
    p.cds[slot] = rushed ? ab.cd * 2 : ab.cd;
    w.events.push({ t: 'ability', name: ab.name, x: p.x, y: p.y - 60 });
  } else if (ab.id === 'cheapshot') {
    // Sucker Punch: a lunge-jab that only LANDS on an enemy mid-telegraph
    p.cds[slot] = ab.cd;
    p.iframes = Math.max(p.iframes, 0.15);
    // find the nearest telegraphing foe ahead of us within lunge range
    let target = null, bd = 280;
    for (const f of w.foes) {
      if (f.dead || f.state !== 'tell') continue;
      const d = Math.abs(f.x - p.x);
      if (d < bd && sign(f.x - p.x) === p.facing) { bd = d; target = f; }
    }
    if (target) {
      p.x = target.x - p.facing * 44; // the lunge itself
      target.state = 'hurt'; target.stateT = 0.5;
      damageFoe(w, target, { dmg: 22, kb: { vx: 260, vy: -180 }, hitstop: 0.1 });
      w.events.push({ t: 'interrupt', x: target.x, y: target.y - target.h });
    } else {
      p.vx = p.facing * 420;
      p.hurtT = 0.35; // heavy whiff lag — commit to your reads
    }
    w.events.push({ t: 'ability', name: ab.name, x: p.x, y: p.y - 60 });
  } else if (ab.id === 'rupture') {
    // Earthquake: hits all GROUNDED enemies in a wide radius; whiffs vs airborne
    p.cds[slot] = ab.cd;
    p.hurtT = 0.22; // slam commitment
    for (const f of [...w.foes]) {
      if (f.dead || !f.onGround) continue;
      if (Math.abs(f.x - p.x) < 330) {
        damageFoe(w, f, { dmg: 16, kb: { vx: 120, vy: -420 }, hitstop: 0.08, launch: true });
      }
    }
    for (const py of w.pylons) {
      if (py.hp > 0 && Math.abs(py.x - p.x) < 330) {
        py.hp -= 16;
        w.events.push({ t: 'pylon_hit', x: py.x, y: GROUND_Y - 40, dmg: 16 });
        if (py.hp <= 0) w.events.push({ t: 'pylon_down', x: py.x, y: GROUND_Y - 40 });
      }
    }
    w.events.push({ t: 'rupture', x: p.x, y: p.y });
  }
}

// ---------- player step ----------
function startAttack(w, key) {
  const p = w.player;
  p.atk = { def: ATTACKS[key], key, t: 0, struck: new Set() };
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

function stepPlayer(w, dt, input) {
  const p = w.player;
  p.animT += dt;
  p.iframes = Math.max(0, p.iframes - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.guardT = Math.max(0, p.guardT - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.comboT -= dt; if (p.comboT <= 0) p.combo = 0;
  for (let i = 0; i < 3; i++) p.cds[i] = Math.max(0, p.cds[i] - dt);

  // buffer edges (react on press, resolve when legal)
  if (input.atk) bufferAction(p, 'atk', w.t);
  if (input.jump) bufferAction(p, 'jump', w.t);
  if (input.dash) bufferAction(p, 'dash', w.t);
  if (input.ab1) useAbility(w, 0);
  if (input.ab2) useAbility(w, 1);
  if (input.ab3) useAbility(w, 2);

  // dash-dodge (works during almost anything except hurt)
  if (p.hurtT <= 0 && p.dashCd <= 0 && consume(p, 'dash', w.t)) {
    p.dashT = 0.28;
    p.dashDir = input.mx !== 0 ? sign(input.mx) : p.facing;
    p.dashCd = 0.55;
    p.iframes = Math.max(p.iframes, 0.14); // i-frames on the FIRST HALF of the dash
    p.atk = null; p.diving = false;
    w.events.push({ t: 'dash', x: p.x, y: p.y - 20 });
  }

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDir * 620;
    p.x += p.vx * dt;
    p.x = clamp(p.x, 20, w.arena.w - 20);
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
    a.t += dt;
    const d = a.def;
    // active window: sweep the hitbox
    if (a.t >= d.startup && a.t <= d.startup + d.active) {
      const [hx, hy, hw, hh] = playerHitbox(p, d);
      for (const f of w.foes) {
        if (f.dead || a.struck.has(f)) continue;
        const [fx, fy, fw, fh] = foeHurtbox(f);
        if (rectsHit(hx, hy, hw, hh, fx, fy, fw, fh)) {
          a.struck.add(f);
          damageFoe(w, f, d);
        }
      }
      if (!a.pylonsHit) { a.pylonsHit = true; hitPylons(w, d, hx, hy, hw, hh); }
    }
    const total = d.startup + d.active + d.recovery;
    // jump-cancel on HIT: a connected launcher/chain can cancel into a jump —
    // this is what makes launch → chase → aerial juggles flow
    if (a.hit && a.t >= d.startup && consume(p, 'jump', w.t)) {
      p.atk = null;
      if (p.onGround || p.coyoteT > 0) { p.vy = JUMP_VY; p.onGround = false; p.jumps = 1; }
      else if (p.jumps > 0) { p.vy = DJUMP_VY; p.jumps--; }
      w.events.push({ t: 'jump', cancel: true });
      return;
    }
    // chain cancel: buffered attack after cancelFrom rolls into the next hit
    if (d.next && a.t >= (d.cancelFrom || total) && consume(p, 'atk', w.t)) {
      startAttack(w, input.my < -0.5 ? 'launcher' : d.next);
    } else if (a.t >= total) {
      p.atk = null;
    }
    // air attacks keep falling; ground attacks drift slightly forward
    if (d.air || !p.onGround) stepGravity(p, dt, w);
    else p.x += p.facing * 30 * dt;
    p.x = clamp(p.x, 20, w.arena.w - 20);
    if (!p.atk) p.state = 'idle';
    return;
  }

  // movement
  p.vx = input.mx * MOVE_SPD;
  if (input.mx !== 0) p.facing = sign(input.mx);
  p.x += p.vx * dt;
  p.x = clamp(p.x, 20, w.arena.w - 20);

  // jumping (coyote + buffer + double jump)
  const canGroundJump = p.onGround || p.coyoteT > 0;
  if (consume(p, 'jump', w.t)) {
    if (canGroundJump) {
      p.vy = JUMP_VY; p.onGround = false; p.coyoteT = 0; p.jumps = 1;
      w.events.push({ t: 'jump' });
    } else if (p.jumps > 0) {
      p.vy = DJUMP_VY; p.jumps--;
      w.events.push({ t: 'jump', double: true });
    }
  }

  // dive slam: down+attack in the air
  if (!p.onGround && input.my > 0.5 && consume(p, 'atk', w.t)) {
    p.diving = true;
    p.vy = DIVE_VY;
    w.events.push({ t: 'dive' });
  } else if (consume(p, 'atk', w.t)) {
    // grounded: chain or launcher; airborne: aerial
    if (!p.onGround) startAttack(w, 'aerial');
    else if (input.my < -0.5) startAttack(w, 'launcher');
    else startAttack(w, 'c1');
  }

  stepGravity(p, dt, w);
  p.state = p.onGround ? (Math.abs(p.vx) > 20 ? 'run' : 'idle') : 'air';
}

function stepGravity(p, dt, w) {
  if (p.onGround) {
    p.coyoteT = COYOTE;
    return;
  }
  p.coyoteT = Math.max(0, p.coyoteT - dt);
  p.vy += GRAV * dt;
  p.y += p.vy * dt;
  if (p.y >= GROUND_Y) {
    p.y = GROUND_Y;
    p.onGround = true;
    p.jumps = 2;
    p.vy = 0;
    if (p.diving) {
      p.diving = false;
      // dive slam impact
      const d = ATTACKS.divehit;
      for (const f of w.foes) {
        if (f.dead) continue;
        if (Math.abs(f.x - p.x) < 90 && f.onGround) damageFoe(w, f, d);
      }
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
  f.animT += dt;
  f.hitFlash = Math.max(0, f.hitFlash - dt);

  // airborne physics (launched/juggled)
  if (!f.onGround) {
    f.vy += GRAV * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.x = clamp(f.x, 20, w.arena.w - 20);
    if (f.y >= GROUND_Y) {
      f.y = GROUND_Y; f.onGround = true; f.vy = 0; f.vx = 0; f.juggle = 0;
      f.state = 'down'; f.stateT = 0.5;
      w.events.push({ t: 'foe_land', x: f.x, y: f.y });
    }
    return;
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

  const dx = p.x - f.x;
  const dist = Math.abs(dx);
  f.facing = sign(dx) || f.facing;

  if (f.state === 'idle') {
    f.stateT -= dt;
    if (f.stateT <= 0) f.state = 'approach';
  } else if (f.state === 'approach') {
    if (dist > (f.species === 'growler' ? 190 : 90)) {
      f.x += sign(dx) * B.walk * dt;
    } else {
      f.state = 'tell'; f.stateT = f.boss ? f.boss.tell : B.tell;
      f.attackHit = false;
      w.events.push({ t: 'tell', x: f.x, y: f.y - f.h - 10, species: f.species });
    }
  } else if (f.state === 'tell') {
    // THE telegraph — every lethal thing winds up visibly
    f.stateT -= dt;
    if (f.stateT <= 0) {
      f.state = 'attack'; f.stateT = B.attackT;
      f.attackDir = sign(dx) || f.facing;
      w.events.push({ t: 'foe_attack', species: f.species });
    }
  } else if (f.state === 'attack') {
    f.stateT -= dt;
    f.x += f.attackDir * B.attackV * dt;
    f.x = clamp(f.x, 20, w.arena.w - 20);
    if (!f.attackHit) {
      const [fx, fy, fw, fh] = foeHurtbox(f);
      const [px, py, pw, ph] = playerHurtbox(p);
      if (rectsHit(fx, fy, fw, fh, px, py, pw, ph) && p.y > GROUND_Y - 60) {
        // perfect dodge: their active window met your dash i-frames
        if (p.iframes > 0 && p.dashT > 0) {
          if (!f.pdodged) {
            f.pdodged = true;
            p.pdodges++;
            w.slowmoT = 0.35;
            w.events.push({ t: 'pdodge', x: p.x, y: p.y - 60 });
          }
        } else {
          w.lastThreat = f.boss ? `${f.boss.name}` : `${B.name}'s ${f.species === 'growler' ? 'lunge' : 'rush'}`;
          if (hurtPlayer(w, f.boss ? f.boss.dmg : B.dmg, f.x)) f.attackHit = true;
        }
      }
    }
    if (f.stateT <= 0) { f.state = 'recover'; f.stateT = B.recover; f.pdodged = false; }
  } else if (f.state === 'recover') {
    f.stateT -= dt;
    if (f.stateT <= 0) { f.state = 'idle'; f.stateT = 0.3 + w.rng() * 0.8; }
  }
}

// ---------- camera ----------
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

  stepPlayer(w, dt, input);
  for (const f of w.foes) if (!f.dead) stepFoe(w, f, dt);
  // deferred removal (never splice mid-frame structures)
  for (let i = w.foes.length - 1; i >= 0; i--) if (w.foes[i].dead) w.foes.splice(i, 1);
  stepCamera(w, dt);

  // heal-can pickups
  const p = w.player;
  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const pk = w.pickups[i];
    if (Math.abs(pk.x - p.x) < 40 && p.y > GROUND_Y - 50) {
      p.hp = Math.min(p.maxHp, p.hp + pk.heal);
      w.events.push({ t: 'heal', amt: pk.heal, x: pk.x, y: GROUND_Y - 30 });
      w.pickups.splice(i, 1);
    }
  }

  // mission director
  if (w.mission && !w.mission.done) {
    const def = w.mission.def;
    if (def.type === 'sabotage') {
      // waves keep coming while the pylons stand
      if (w.pylons.every((py) => py.hp <= 0)) {
        w.mission.done = true;
        w.events.push({ t: 'mission_complete' });
      } else if (w.foes.length === 0) {
        w.mission.wave++;
        spawnWave(w);
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

  // M1 practice yard: keep the crowd topped up
  if (w.practice && w.foes.length < 2) {
    const species = w.rng() < 0.4 ? 'growler' : 'skitterlin';
    const x = w.player.x > w.arena.w / 2 ? 140 : w.arena.w - 140;
    mkFoe(w, species, x);
    w.events.push({ t: 'spawn', species });
  }
}
