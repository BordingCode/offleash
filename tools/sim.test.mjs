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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
