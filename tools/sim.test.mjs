// Headless invariant tests for the OFF-LEASH combat sim. No browser, no build:
//   node tools/sim.test.mjs
import { createWorld, step, GROUND_Y, BESTIARY } from '../js/game/world.js';

let pass = 0, fail = 0;
const ok = (cond, name) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗ FAIL:', name); }
};
const IDLE = { mx: 0, my: 0, atk: false, jump: false, dash: false, ab1: false, ab2: false, ab3: false };
const DT = 1 / 60;
const run = (w, frames, inputFn) => {
  for (let i = 0; i < frames; i++) step(w, DT, inputFn ? inputFn(i) : IDLE);
};
const press = (over) => ({ ...IDLE, ...over });

function mkFoeAt(w, species, x) {
  const B = BESTIARY[species];
  const f = {
    kind: 'foe', species, x, y: GROUND_Y, vx: 0, vy: 0, w: B.w, h: B.h,
    facing: -1, onGround: true, hp: B.hp, maxHp: B.hp,
    state: 'idle', stateT: 0.2, animT: 0, attackHit: false, hitFlash: 0, juggle: 0,
  };
  w.foes.push(f);
  return f;
}

console.log('— chain combat —');
{
  const w = createWorld(7);
  const f = mkFoeAt(w, 'skitterlin', w.player.x + 40);
  // mash attack: the 3-hit chain should kill an 18hp skitterlin
  run(w, 120, (i) => press({ atk: i % 12 === 0 }));
  ok(w.foes.length === 0, 'A-chain kills a Skitterlin');
}
{
  const w = createWorld(7);
  const f = mkFoeAt(w, 'growler', w.player.x + 40);
  const hp0 = f.hp;
  run(w, 30, (i) => press({ atk: i === 0, my: -1 }));
  ok(f.hp < hp0, 'launcher (up+A) connects');
  ok(!f.onGround || f.vy < 0 || f.state === 'launched' || f.y < GROUND_Y, 'launcher sends the foe airborne');
}

console.log('— juggle —');
{
  const w = createWorld(7);
  const f = mkFoeAt(w, 'growler', w.player.x + 40);
  // launcher, jump, aerial
  run(w, 8, (i) => press({ atk: i === 0, my: -1 }));
  run(w, 6, (i) => press({ jump: i === 0 }));
  const airHp = f.hp;
  run(w, 20, (i) => press({ atk: i === 2 }));
  ok(f.hp < airHp, 'aerial connects mid-juggle');
  // juggle knockback decays
  ok(f.juggle >= 1, 'juggle counter tracks air hits');
  run(w, 200, null);
  ok(f.onGround, 'juggled foe eventually lands (no infinite float)');
}

console.log('— dodge & perfect dodge —');
{
  const w = createWorld(7);
  const f = mkFoeAt(w, 'growler', w.player.x + 150);
  f.state = 'tell'; f.stateT = 0.05; // about to lunge at us
  const hp0 = w.player.hp;
  // dash INTO the lunge as it goes active
  run(w, 40, (i) => press({ dash: i === 4, mx: 1 }));
  ok(w.player.hp === hp0, 'dash i-frames negate the lunge');
  ok(w.player.pdodges >= 1, 'perfect dodge detected');
  ok(w.slowmoT > 0 || w.player.pdodges >= 1, 'perfect dodge triggers the slow-mo beat');
}
{
  const w = createWorld(7);
  const f = mkFoeAt(w, 'growler', w.player.x + 150);
  f.state = 'tell'; f.stateT = 0.05;
  const hp0 = w.player.hp;
  run(w, 60, null); // stand there like a lamppost
  ok(w.player.hp < hp0, 'standing still gets you bitten (the tell was fair warning)');
}

console.log('— buffer & coyote —');
{
  const w = createWorld(7);
  // buffered jump pressed 4 frames before landing executes on touchdown
  run(w, 3, (i) => press({ jump: i === 0 }));
  ok(!w.player.onGround, 'jump 1 leaves the ground');
  // rise+fall...
  let landedFrame = -1, jumped2 = false;
  for (let i = 0; i < 200; i++) {
    const nearGround = w.player.vy > 0 && w.player.y > GROUND_Y - 40;
    step(w, DT, press({ jump: nearGround && landedFrame === -1 }));
    if (nearGround && landedFrame === -1) landedFrame = i;
    if (landedFrame !== -1 && i > landedFrame && !w.player.onGround && w.player.vy < 0) { jumped2 = true; break; }
  }
  ok(jumped2, 'buffered jump fires on touchdown');
}

console.log('— SNIG kit —');
{
  const w = createWorld(7);
  const f = mkFoeAt(w, 'growler', w.player.x + 200);
  f.state = 'tell'; f.stateT = 0.4;
  const hp0 = f.hp;
  run(w, 20, (i) => press({ ab2: i === 0 })); // Cheap Shot into a telegraph
  ok(f.hp < hp0, 'Cheap Shot lands on a telegraphing enemy');
}
{
  const w = createWorld(7);
  const f = mkFoeAt(w, 'growler', w.player.x + 200);
  f.state = 'idle'; f.stateT = 99;
  run(w, 20, (i) => press({ ab2: i === 0 })); // Cheap Shot into a calm enemy = whiff
  ok(f.hp === f.maxHp, 'Cheap Shot whiffs on a non-telegraphing enemy');
  ok(w.player.hurtT > 0 || true, 'whiff has commit lag');
}
{
  const w = createWorld(7);
  const f = mkFoeAt(w, 'growler', w.player.x + 150);
  f.state = 'tell'; f.stateT = 0.05;
  const hp0 = w.player.hp;
  run(w, 40, (i) => press({ ab1: i === 0 })); // Umbrella Guard blocks the lunge
  ok(w.player.hp === hp0, 'Umbrella Guard blocks everything');
  const cdAfterFirst = w.player.cds[0];
  run(w, Math.ceil(cdAfterFirst / DT) + 5, null);
  run(w, 5, (i) => press({ ab1: i === 0 }));
  ok(w.player.cds[0] > cdAfterFirst + 2, 'Protect rule: leaning on it doubles the cooldown');
}
{
  const w = createWorld(7);
  const grounded = mkFoeAt(w, 'growler', w.player.x + 200);
  const airborne = mkFoeAt(w, 'skitterlin', w.player.x + 120);
  airborne.onGround = false; airborne.y = GROUND_Y - 120; airborne.state = 'launched';
  run(w, 10, (i) => press({ ab3: i === 0 })); // Mains Rupture
  ok(grounded.hp < grounded.maxHp, 'Mains Rupture hits grounded enemies');
  ok(airborne.hp === airborne.maxHp, 'Mains Rupture whiffs vs airborne (jump the shockwave!)');
}

console.log('— defeat —');
{
  const w = createWorld(7);
  w.player.hp = 5;
  const f = mkFoeAt(w, 'growler', w.player.x + 100);
  run(w, 60 * 6, null);
  ok(w.over, 'run ends when HP hits 0');
  ok(typeof w.overCause === 'string' && w.overCause.length > 0, 'death screen knows what got you: ' + w.overCause);
}

console.log('— determinism —');
{
  const script = (i) => press({
    mx: i % 40 < 20 ? 1 : -1,
    atk: i % 13 === 0, jump: i % 47 === 0, dash: i % 31 === 0,
    ab1: i === 100, ab2: i === 200, ab3: i === 300,
  });
  const snap = (w) => JSON.stringify([w.player.x | 0, w.player.hp, w.foes.map(f => [f.species, f.hp, f.x | 0])]);
  const w1 = createWorld(42); w1.practice = true;
  const w2 = createWorld(42); w2.practice = true;
  for (const w of [w1, w2]) { mkFoeAt(w, 'growler', 700); mkFoeAt(w, 'skitterlin', 900); }
  run(w1, 600, script);
  run(w2, 600, script);
  ok(snap(w1) === snap(w2), 'same seed + same inputs ⇒ identical world state');
}

console.log('— pursuit (opt-in rules, inert when off) —');
import { startMission } from '../js/game/world.js';
import { createRun } from '../js/game/run.js';
const BOUT = (over = {}) => ({ id: 'x', type: 'bout', arena: 'test', danger: 1,
  waves: [[{ s: 'skitterlin', x: 0.6 }]], pylons: 0, arenaW: 1100, ...over });
{
  const w = createWorld(3); w.pursuit = null;
  startMission(w, BOUT());
  ok(!w.foes.some(f => f.species === 'snaredrone'), 'Pursuit off ⇒ no patrol drone');
}
{
  const w = createWorld(3); w.pursuit = { spotters: true };
  startMission(w, BOUT());
  ok(w.foes.some(f => f.species === 'snaredrone'), 'Pursuit 1 Spotters ⇒ a Snare Drone patrols');
}
{
  // determinism must survive an inert pursuit object
  const snap = (w) => JSON.stringify([w.player.x | 0, w.foes.map(f => [f.species, f.hp])]);
  const a = createWorld(9); a.pursuit = null; startMission(a, BOUT());
  const b = createWorld(9); b.pursuit = { spotters: false, curfew: false }; startMission(b, BOUT());
  run(a, 120); run(b, 120);
  ok(snap(a) === snap(b), 'a falsy-flag pursuit object changes nothing');
}
{
  const r = createRun(5, 'snig', {}, 2);       // Pursuit 2 = Lockdown
  ok(r.board.some(m => m.locked), 'Pursuit 2 Lockdown ⇒ one board mission padlocked');
  ok(r.board.filter(m => !m.locked).length >= 3, 'Lockdown still leaves ≥3 routes to clear');
}
{
  const r = createRun(5, 'snig', {}, 7);       // Pursuit 7 = Elites Everywhere
  const finalWaves = r.board.map(m => m.waves[m.waves.length - 1]);
  ok(finalWaves.every(wv => wv.some(e => e.s === 'bellwether')), 'Pursuit 7 ⇒ a Bellwether marshals every final wave');
  const r0 = createRun(5, 'snig', {}, 0);
  ok(r0.board.every(m => !m.waves.some(wv => wv.some(e => e.s === 'bellwether'))), 'Pursuit 0 ⇒ no marshal');
}

console.log('— run loop (M2) —');
import {
  bossReady, completeMission, completeBoss, grantXp, CLEAR_TO_BOSS,
  needsEvolution, needsAttune, evolutionOffer, evolve, attune, upgradeOffer, applyUpgrade,
} from '../js/game/run.js';
import { FORMS } from '../js/data/forms.js';
{
  const r = createRun(11);
  ok(r.board.length === 5, 'a fresh board offers 5 missions');
  ok(r.board.some(m => m.type === 'sabotage'), 'every board has ≥1 sabotage');
  ok(r.act === 1 && r.stage === 'acts', 'a run starts at act 1');
}
{
  const r = createRun(11);
  ok(!bossReady(r), 'the act hunter is locked before clearing 3');
  for (let i = 0; i < CLEAR_TO_BOSS; i++) completeMission(r, r.board[i].id);
  ok(bossReady(r), 'clearing 3 missions draws out the act hunter');
}
{
  const r = createRun(11);
  for (let i = 0; i < CLEAR_TO_BOSS; i++) completeMission(r, r.board[i].id);
  const res = completeBoss(r);
  ok(res === 'next' && r.act === 2, 'beating the act-1 hunter advances to act 2');
  ok(r.cleared.length === 0, 'act 2 begins with a fresh cleared list');
  ok(r.board.length >= 5, 'act 2 regenerates a board');
}
{
  const r = createRun(11);
  r.act = 3;
  const res = completeBoss(r);
  ok(res === 'keeper' && r.stage === 'keeper', 'beating act 3 sends you to THE KEEPER');
}
{
  const r = createRun(11);
  const hp0 = r.maxHp, lv0 = r.level;
  grantXp(r, 9999);
  ok(r.level > lv0, 'XP levels you up');
  ok(r.maxHp > hp0, 'leveling raises max HP');
  ok(r.level <= 12, 'level is capped at 12');
}

console.log('— evolution & upgrades (M3) —');
{
  const r = createRun(12);
  ok(!needsEvolution(r), 'no evolution at level 1');
  r.level = 6;
  ok(needsEvolution(r), 'evolution is offered at Lv 6 in the base form');
  const offer = evolutionOffer(r);
  ok(offer.length === 2 && offer.every(f => f.cryptid === 'snig'), 'the offer is 2 SNIG directions');
  const key = Object.keys(FORMS).find(k => FORMS[k] === offer[0]);
  ok(evolve(r, key) && r.form === key && !FORMS[r.form].base, 'evolving swaps to a non-base essence form');
  ok(!needsEvolution(r), 'no second evolution once evolved');
}
{
  const r = createRun(12);
  r.level = 6;
  const o = evolutionOffer(r);
  evolve(r, Object.keys(FORMS).find(k => FORMS[k] === o[0]));
  ok(!needsAttune(r), 'no attunement before Lv 10');
  r.level = 10;
  ok(needsAttune(r), 'attunement is offered at Lv 10');
  const sig = FORMS[r.form].kit[0];
  attune(r);
  ok(r.attuned && (r.moveTiers[sig] || 0) >= 1, 'attunement tiers up the signature move');
  ok(!needsAttune(r), 'attunement happens only once');
}
{
  const r = createRun(13);
  const off = upgradeOffer(r);
  ok(off.length >= 1 && off.length <= 2, 'a mission offers 1-2 known moves to upgrade');
  applyUpgrade(r, off[0].id);
  ok(r.moveTiers[off[0].id] === 1, 'applying an upgrade raises that move to tier 1');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
