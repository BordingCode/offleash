// Boot + glue: sim events -> FX/audio/HUD. Pure sim lives in game/world.js.
import { CanvasView } from './engine/canvas.js';
import { GameLoop } from './engine/loop.js';
import { FX, updateFX, addTrauma, hitStop, screenFlash, burst, shockwave, floatText } from './engine/fx.js';
import { buildSprites } from './data/sprites.js';
import { createWorld, seedPractice, step, KIT } from './game/world.js';
import { draw } from './game/render.js';
import { Input } from './game/input.js';
import { initAudio, resumeAudio, sfx, startMusic, setMuted, isMuted, setIntensity } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const view = new CanvasView(canvas);
const S = buildSprites();
const input = new Input($('stickzone'), {
  atk: 'atkbtn', jump: 'jumpbtn', dash: 'dashbtn',
  abilities: ['ab1btn', 'ab2btn', 'ab3btn'],
});

let world = createWorld(1);
world.practice = true;
seedPractice(world);
let started = false;
let frameMs = 0;
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
FX.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- HUD ----------
const hud = { hp: -1, cds: [-1, -1, -1] };
function renderHud() {
  const p = world.player;
  if (p.hp !== hud.hp) {
    hud.hp = p.hp;
    $('hpfill').style.width = Math.max(0, (p.hp / p.maxHp) * 100) + '%';
    $('hpfill').classList.toggle('low', p.hp <= 30);
  }
  for (let i = 0; i < 3; i++) {
    const cd = Math.ceil(p.cds[i]);
    if (cd !== hud.cds[i]) {
      hud.cds[i] = cd;
      const btn = $(`ab${i + 1}btn`);
      btn.classList.toggle('cooling', cd > 0);
      btn.querySelector('.cdnum').textContent = cd > 0 ? cd : '';
    }
  }
}
function showToast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- defeat screen ----------
function showDefeat(cause) {
  $('defcause').textContent = `Caught by ${cause}.`;
  $('defstats').textContent = `Foes felled: ${defeatStats.kos} · best combo ×${defeatStats.bestCombo} · perfect dodges: ${world.player.pdodges}`;
  $('defeat').classList.add('show');
}
const defeatStats = { kos: 0, bestCombo: 0 };
$('againbtn').addEventListener('pointerup', () => {
  $('defeat').classList.remove('show');
  world = createWorld((Math.random() * 1e9) | 0);
  world.practice = true;
  seedPractice(world);
  defeatStats.kos = 0; defeatStats.bestCombo = 0;
  hud.hp = -1;
  sfx.ui();
});

// ---------- events -> juice ----------
function handleEvents() {
  for (const ev of world.events) {
    switch (ev.t) {
      case 'swing': sfx.swing(ev.big); break;
      case 'hit':
        sfx.hit(ev.big);
        hitStop(ev.hitstop || 0.04);
        if (ev.big) addTrauma(0.2);
        burst(ev.x, ev.y, ev.big ? 12 : 6, { color: ev.big ? '#e05fd0' : '#ffffff', speed: 150, grav: 300 });
        floatText(ev.x, ev.y - 10, String(ev.dmg), { color: ev.big ? '#ffb8f0' : '#f2ead9', size: ev.big ? 22 : 16, crit: ev.big });
        break;
      case 'foe_down':
        sfx.foeDown(); addTrauma(0.15);
        defeatStats.kos++;
        defeatStats.bestCombo = Math.max(defeatStats.bestCombo, ev.combo);
        burst(ev.x, ev.y, 18, { color: '#3ee6d2', speed: 200, grav: 200 });
        break;
      case 'foe_land': burst(ev.x, ev.y, 6, { color: '#776a85', speed: 110, grav: 250 }); break;
      case 'jump': sfx.jump(); break;
      case 'dive': sfx.dash(); break;
      case 'slam':
        sfx.slam(); hitStop(0.06); addTrauma(0.3);
        shockwave(ev.x, ev.y, { color: '#ffb347', max: 90 });
        break;
      case 'land': break;
      case 'dash': sfx.dash(); break;
      case 'pdodge':
        sfx.pdodge();
        world.slowmoT = 0.35;
        floatText(ev.x, ev.y, 'PERFECT', { color: '#3ee6d2', size: 20, crit: true });
        break;
      case 'tell': sfx.tell(); break;
      case 'player_hurt':
        sfx.hurt(); hitStop(0.07); addTrauma(0.35); screenFlash(0.22, '224,95,208');
        floatText(ev.x, ev.y, `-${ev.dmg}`, { color: '#ff8fa3', size: 20 });
        break;
      case 'blocked': sfx.blocked(); floatText(ev.x, ev.y, 'blocked', { color: '#9fc4e8', size: 14 }); break;
      case 'ability': sfx.ability(); floatText(ev.x, ev.y, ev.name, { color: '#b8fff2', size: 14 }); break;
      case 'interrupt':
        sfx.interrupt(); hitStop(0.1);
        floatText(ev.x, ev.y, 'INTERRUPTED', { color: '#ffe08a', size: 18, crit: true });
        break;
      case 'rupture':
        sfx.slam(); addTrauma(0.4); hitStop(0.08);
        shockwave(ev.x, ev.y, { color: '#d96c3a', max: 330, dur: 0.5 });
        break;
      case 'defeat':
        sfx.defeat(); addTrauma(0.5);
        setTimeout(() => showDefeat(ev.cause), 700);
        break;
      case 'spawn': break;
    }
  }
  if (world.msg && world.msg !== handleEvents._last) showToast(world.msg);
  handleEvents._last = world.msg;
  renderHud();
}

// ---------- loop ----------
const loop = new GameLoop({
  update(dt) {
    if (!started) return;
    updateFX(dt);
    if (FX.freeze > 0) { FX.freeze -= dt; return; }
    loop.speed = world.slowmoT > 0 ? 0.3 : 1;
    step(world, dt, input.poll());
    handleEvents();
  },
  render() {
    const t0 = performance.now();
    draw(view, world, S);
    frameMs = frameMs * 0.95 + (performance.now() - t0) * 0.05;
    updateStick();
  },
});
window.addEventListener('resize', () => view.resize());

// visible stick indicator
let stickShown = false;
function updateStick() {
  const base = $('stickbase'), knob = $('stickknob');
  if (input.stick.id === -1) {
    if (stickShown) { stickShown = false; base.classList.remove('show'); }
    return;
  }
  if (!stickShown) { stickShown = true; base.classList.add('show'); }
  base.style.transform = `translate3d(${input.stick.ox}px, ${input.stick.oy}px, 0) translate(-50%,-50%)`;
  const dx = Math.max(-40, Math.min(40, input.stick.x - input.stick.ox));
  const dy = Math.max(-40, Math.min(40, input.stick.y - input.stick.oy));
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

// ---------- title ----------
$('startbtn').addEventListener('pointerup', () => {
  initAudio(); resumeAudio(); startMusic(); setIntensity(0.7);
  $('title').classList.add('hidden');
  started = true;
  showToast('Practice yard — spar freely. (This is milestone 1.)');
});
$('mutebtn').addEventListener('pointerup', (e) => {
  const m = setMuted(!isMuted());
  e.target.textContent = m ? '×' : '♪';
  localStorage.setItem('offleash_muted', m ? '1' : '0');
});
if (localStorage.getItem('offleash_muted') === '1') { setMuted(true); $('mutebtn').textContent = '×'; }

loop.start();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}

// debug/test hooks
window.__ol = {
  get world() { return world; },
  input, view, errors, loop, FX, KIT,
  get frameMs() { return frameMs; },
  start() { $('startbtn').dispatchEvent(new Event('pointerup')); },
};
