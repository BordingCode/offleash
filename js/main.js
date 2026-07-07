// Boot + glue: screens (title → board → fight), sim events -> FX/audio/HUD/save.
// Pure sim in game/world.js; run logic in game/run.js; persistence in game/save.js.
import { CanvasView } from './engine/canvas.js';
import { GameLoop } from './engine/loop.js';
import { FX, updateFX, addTrauma, hitStop, screenFlash, burst, shockwave, floatText } from './engine/fx.js';
import { buildSprites } from './data/sprites.js';
import { createWorld, seedPractice, step, startMission, startBoss, KIT } from './game/world.js';
import { createRun, missionById, clearedCount, bossReady, actBoss, completeMission, completeBoss, grantXp, CLEAR_TO_BOSS } from './game/run.js';
import { HEAL_AFTER_BOSS, MISSION_TYPES } from './data/missions.js';
import * as SAVE from './game/save.js';
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

// ---------- persistent state ----------
const loaded = SAVE.load();
let meta = loaded.meta;
let run = loaded.run;               // null = no escape underway
let world = createWorld(1);
let mode = 'title';                 // title | board | fight
let started = false;
let frameMs = 0;
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
FX.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const saveAll = () => SAVE.save(meta, run, { muted: isMuted() });

// ---------- HUD ----------
const hud = { hp: -1, max: -1, cds: [-1, -1, -1], runline: '' };
function renderHud() {
  const p = world.player;
  if (p.hp !== hud.hp || p.maxHp !== hud.max) {
    hud.hp = p.hp; hud.max = p.maxHp;
    $('hpfill').style.width = Math.max(0, (p.hp / p.maxHp) * 100) + '%';
    $('hpfill').classList.toggle('low', p.hp <= p.maxHp * 0.3);
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
  const line = run ? `ACT ${run.act} · Lv ${run.level}` : '';
  if (line !== hud.runline) { hud.runline = line; $('runline').textContent = line; }
}
function showToast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- the mission board ----------
const ESSENCE_ICON = { static: '⚡', rain: '🌧', rust: '⚙', moon: '🌙' };
function openBoard() {
  mode = 'board';
  setIntensity(0.35);
  const list = $('missions');
  list.innerHTML = '';
  for (const m of run.board) {
    const done = run.cleared.includes(m.id);
    const card = document.createElement('button');
    card.className = 'mission' + (done ? ' done' : '');
    card.innerHTML = `
      <span class="mtype">${MISSION_TYPES[m.type].icon} ${MISSION_TYPES[m.type].name}</span>
      <strong>${m.arena}</strong>
      <em>${m.flavor}</em>
      <span class="mdanger">${'✦'.repeat(m.danger)}${done ? ' · CLEARED' : ''}</span>`;
    if (!done) {
      card.addEventListener('pointerup', () => enterMission(m.id));
    }
    list.appendChild(card);
  }
  // the act boss card
  const boss = document.createElement('button');
  const ready = bossReady(run);
  boss.className = 'mission boss' + (ready ? '' : ' locked');
  const B = actBoss(run);
  boss.innerHTML = `
    <span class="mtype">☠ ACT ${run.act} HUNT</span>
    <strong>${B.name}</strong>
    <em>${ready ? 'It knows you’re coming. Go anyway.' : `Clear ${CLEAR_TO_BOSS - clearedCount(run)} more mission${CLEAR_TO_BOSS - clearedCount(run) === 1 ? '' : 's'} to draw it out.`}</em>
    <span class="mdanger">${'✦'.repeat(3)}</span>`;
  if (ready) boss.addEventListener('pointerup', enterBoss);
  list.appendChild(boss);

  $('boardsub').textContent =
    `HP ${run.hp}/${run.maxHp} · Lv ${run.level} · ` +
    Object.entries(run.essence).filter(([, v]) => v > 0).map(([k, v]) => `${ESSENCE_ICON[k]}${v}`).join(' ') || '';
  $('boardact').textContent = `ACT ${run.act} — ${['the outer yards', 'the deep city', 'the facility ring'][run.act - 1]}`;
  $('board').classList.add('show');
}

function syncPlayerFromRun() {
  world.player.hp = run.hp;
  world.player.maxHp = run.maxHp;
}
function syncRunFromWorld() {
  run.hp = Math.max(0, world.player.hp);
  for (const [k, v] of Object.entries(world.essenceGained)) {
    run.essence[k] += v;
    world.essenceGained[k] = 0;
  }
}

function enterMission(id) {
  const m = missionById(run, id);
  if (!m) return;
  run.atMission = id;
  saveAll();                        // snapshot BEFORE the fight — quitting resumes here
  world = createWorld(run.seed * 131 + run.missionsDone * 7 + run.act * 31);
  syncPlayerFromRun();
  startMission(world, m);
  $('board').classList.remove('show');
  mode = 'fight';
  setIntensity(0.7);
  sfx.ui();
}

function enterBoss() {
  world = createWorld(run.seed * 977 + run.act);
  syncPlayerFromRun();
  startBoss(world, actBoss(run));
  $('board').classList.remove('show');
  mode = 'fight';
  setIntensity(1.0);
  sfx.ui();
}

// ---------- mission end / defeat / victory ----------
function onMissionComplete() {
  syncRunFromWorld();
  completeMission(run, run.atMission);
  saveAll();
  setTimeout(() => {
    showToast('Cleared. Back to the hideout.');
    openBoard();
  }, 900);
}

function onBossDown() {
  syncRunFromWorld();
  run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * HEAL_AFTER_BOSS));
  const result = completeBoss(run);
  if (result === 'won') {
    meta.wins++; meta.runs++;
    run = null;
    SAVE.clearRun(meta, { muted: isMuted() });
    setTimeout(() => {
      $('winsub').textContent = 'You breach the outer gate. The rain, for once, feels like applause. (The Keeper is waiting… in a later milestone.)';
      $('victory').classList.add('show');
      mode = 'board';
    }, 1200);
  } else {
    saveAll();
    setTimeout(() => {
      showToast(`Act ${run.act - 1} cleared — the city opens. Patched up a little.`);
      openBoard();
    }, 1200);
  }
}

const defeatStats = { kos: 0, bestCombo: 0 };
function showDefeat(cause) {
  meta.runs++;
  const reached = run ? `Reached: act ${run.act}, ${run.missionsDone} missions in.` : '';
  run = null;
  SAVE.clearRun(meta, { muted: isMuted() });
  $('defcause').textContent = `Caught by ${cause}.`;
  $('defstats').textContent = `${reached} Foes felled: ${defeatStats.kos} · best combo ×${defeatStats.bestCombo} · perfect dodges: ${world.player.pdodges}`;
  $('defeat').classList.add('show');
}
$('againbtn').addEventListener('pointerup', () => {
  $('defeat').classList.remove('show');
  newRun();
});
$('winbtn').addEventListener('pointerup', () => {
  $('victory').classList.remove('show');
  newRun();
});

function newRun() {
  run = createRun((Math.random() * 1e9) | 0);
  defeatStats.kos = 0; defeatStats.bestCombo = 0;
  saveAll();
  sfx.ui();
  openBoard();
}

// ---------- sim events -> juice ----------
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
      case 'xp': if (run) { if (grantXp(run, ev.amt)) { sfx.pdodge(); showToast(`Level ${run.level}!`); } } break;
      case 'essence': floatText(ev.x, ev.y, ESSENCE_ICON[ev.kind], { color: '#b8fff2', size: 16 }); break;
      case 'heal':
        sfx.ui();
        floatText(ev.x, ev.y, `+${ev.amt}`, { color: '#7ef2e2', size: 16 });
        break;
      case 'wave': if (ev.n > 1) showToast(`Wave ${ev.n}`); break;
      case 'pylon_hit': sfx.hit(false); burst(ev.x, ev.y, 5, { color: '#e05fd0', speed: 120 }); break;
      case 'pylon_down':
        sfx.slam(); addTrauma(0.25);
        shockwave(ev.x, ev.y, { color: '#e05fd0', max: 80 });
        break;
      case 'mission_complete':
        sfx.pdodge(); screenFlash(0.3, '62,230,210');
        onMissionComplete();
        break;
      case 'boss_start': sfx.tell(); addTrauma(0.3); break;
      case 'boss_down':
        sfx.foeDown(); screenFlash(0.5, '224,95,208'); addTrauma(0.4);
        onBossDown();
        break;
      case 'foe_land': burst(ev.x, ev.y, 6, { color: '#776a85', speed: 110, grav: 250 }); break;
      case 'jump': sfx.jump(); break;
      case 'dive': sfx.dash(); break;
      case 'slam':
        sfx.slam(); hitStop(0.06); addTrauma(0.3);
        shockwave(ev.x, ev.y, { color: '#ffb347', max: 90 });
        break;
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
    }
  }
  if (world.msg && world.msg !== handleEvents._last) showToast(world.msg);
  handleEvents._last = world.msg;
  renderHud();
}

// ---------- loop ----------
const loop = new GameLoop({
  update(dt) {
    if (!started || mode !== 'fight') return;
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

let stickShown = false;
function updateStick() {
  const base = $('stickbase'), knob = $('stickknob');
  if (input.stick.id === -1 || mode !== 'fight') {
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
  initAudio(); resumeAudio(); startMusic();
  $('title').classList.add('hidden');
  started = true;
  if (!run) run = createRun((Math.random() * 1e9) | 0);
  saveAll();
  openBoard();
});
$('practicebtn').addEventListener('pointerup', () => {
  // the yard: sparring without stakes
  $('board').classList.remove('show');
  world = createWorld((Math.random() * 1e9) | 0);
  world.practice = true;
  if (run) syncPlayerFromRun(); else { world.player.hp = world.player.maxHp = 100; }
  world.player.hp = world.player.maxHp; // sparring is safe for the RUN — hp not synced back
  seedPractice(world);
  mode = 'fight';
  world.practiceReturn = true;
  showToast('Sparring — defeat here costs nothing. Tap RUN LINE to return.');
  sfx.ui();
});
$('runline').addEventListener('pointerup', () => {
  if (mode === 'fight' && world.practice) openBoard();
});
$('mutebtn').addEventListener('pointerup', (e) => {
  const m = setMuted(!isMuted());
  e.target.textContent = m ? '×' : '♪';
  saveAll();
});
if (loaded.settings.muted) { /* applied after initAudio */ }

$('startbtn').textContent = run ? 'CONTINUE THE ESCAPE' : 'RUN';

loop.start();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}

// debug/test hooks
window.__ol = {
  get world() { return world; },
  get run() { return run; },
  get meta() { return meta; },
  input, view, errors, loop, FX, KIT,
  get frameMs() { return frameMs; },
  start() { $('startbtn').dispatchEvent(new Event('pointerup')); },
  enterMission, enterBoss, openBoard,
  save: saveAll,
  reset() { localStorage.removeItem('offleash_save_v1'); location.reload(); },
};
