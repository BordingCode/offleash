// Boot + glue: screens (title → board → fight), sim events -> FX/audio/HUD/save.
// Pure sim in game/world.js; run logic in game/run.js; persistence in game/save.js.
import { CanvasView } from './engine/canvas.js';
import { GameLoop } from './engine/loop.js';
import { FX, updateFX, addTrauma, hitStop, screenFlash, burst, shockwave, floatText } from './engine/fx.js';
import { buildSprites } from './data/sprites.js';
import { createWorld, seedPractice, step, startMission, startTrainer, startKeeper, applyForm, KIT } from './game/world.js';
import { createRun, missionById, clearedCount, bossReady, hunterFor, completeMission, completeBoss, grantXp, CLEAR_TO_BOSS, needsEvolution, needsAttune, evolutionOffer, evolve, attune, upgradeOffer, applyUpgrade } from './game/run.js';
import { KEEPER } from './data/trainers.js';
import { SCENES, DEN_IDLE, RESCUE_ORDER, CRYPTID_NAMES, INTRO } from './data/story.js';
import { ACHIEVEMENTS } from './data/achievements.js';
import { PURSUIT } from './data/pursuit.js';
import { HEAL_AFTER_BOSS, MISSION_TYPES } from './data/missions.js';
import { FORMS } from './data/forms.js';
import { MOVES, ESSENCE_ICON as EICON, ESSENCE_STYLE } from './data/moves.js';
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

// ---------- the den: home between escapes ----------
let denStarter = meta.starters[meta.starters.length - 1] || 'snig';
const SHOP = [
  { id: 'bedding', name: 'Soft Bedding', desc: '+12 max HP on every run', cost: 3 },
  { id: 'contacts', name: 'Noticeboard Contacts', desc: 'boards offer 6 missions', cost: 4 },
  { id: 'scarecrow', name: 'Sparring Scarecrow', desc: 'start runs at Lv 2', cost: 5 },
  { id: 'rainbarrel', name: 'Rain Barrel', desc: '1 patch-up per act (board button)', cost: 6 },
  { id: 'trophy', name: 'Trophy Shelf', desc: 'evolution offers 3 directions', cost: 8 },
];
const STARTER_BLURB = { snig: 'balanced · the favourite', wick: 'fast & fragile · the experiment', phossa: 'aerial · the navigator', dent: 'tank · the oldest asset' };

function openDen() {
  mode = 'den';
  setIntensity(0.3);
  ['board', 'defeat', 'victory'].forEach((id) => $(id).classList.remove('show'));
  // starters
  const row = $('starterrow');
  row.innerHTML = '';
  for (const st of meta.starters) {
    const b = document.createElement('button');
    b.className = 'starter' + (st === denStarter ? ' picked' : '');
    b.innerHTML = `${CRYPTID_NAMES[st]}<em>${STARTER_BLURB[st]}</em>`;
    b.addEventListener('pointerup', () => { denStarter = st; sfx.ui(); openDen(); });
    row.appendChild(b);
  }
  // shop
  const shop = $('denshop');
  shop.innerHTML = '';
  for (const item of SHOP) {
    const owned = meta.powerTrack[item.id];
    const b = document.createElement('button');
    b.className = 'shopitem' + (owned ? ' owned' : '');
    b.innerHTML = `<b>${item.name}</b> ${owned ? '✓' : `· ${item.cost} ⬡`}<br>${item.desc}`;
    if (!owned) b.addEventListener('pointerup', () => {
      if (meta.denTokens >= item.cost) {
        meta.denTokens -= item.cost;
        meta.powerTrack[item.id] = true;
        sfx.pdodge(); saveAll(); openDen();
      } else { showToast('Not enough den tokens — missions pay them.'); }
    });
    shop.appendChild(b);
  }
  // Pursuit selector — only after the first escape succeeds
  const pz = $('denpursuit');
  if ((meta.pursuitBest || 0) >= 1) {
    const cur = Math.min(meta.pursuitNext || 0, meta.pursuitBest);
    const rule = cur > 0 ? PURSUIT[cur - 1] : null;
    pz.innerHTML =
      `<div class="pursuitline">PURSUIT <b>${cur}</b> / ${meta.pursuitBest} unlocked` +
      (rule ? ` — <em>${rule.name}: ${rule.desc}</em>` : ' — <em>the clean escape</em>') +
      ` <button id="pursuitcycle" class="smallbtn">change ▸</button></div>`;
    $('pursuitcycle').addEventListener('pointerup', () => {
      meta.pursuitNext = ((cur + 1) > meta.pursuitBest) ? 0 : cur + 1;
      sfx.ui(); saveAll(); openDen();
    });
  } else pz.innerHTML = '';
  $('densub').textContent =
    `friends home: ${meta.denFriends.length + meta.starters.length - 1} · den tokens: ${meta.denTokens} ⬡ · escapes: ${meta.runs} · out: ${meta.wins}`;
  $('den').classList.add('show');
  // a story scene, if one has unlocked — else idle small talk
  const scene = nextScene();
  if (scene) playScene(scene);
  else {
    const [who, line] = DEN_IDLE[meta.runs % DEN_IDLE.length];
    showToast(`${who}: ${line}`);
  }
}

function metaState() {
  return {
    runs: meta.runs, wins: meta.wins,
    starters: meta.starters.length,
    denFriends: meta.denFriends.length,
    act3Reached: meta.achProgress?.act3Times || 0,
  };
}
function nextScene() {
  const st = metaState();
  return SCENES.find((sc) => !meta.storySeen.includes(sc.id) &&
    Object.entries(sc.when).every(([k, v]) => st[k] >= v));
}
let sceneQ = null, sceneI = 0, sceneDone = null;
function playScene(sc, onDone = null) {
  sceneQ = sc; sceneI = 0; sceneDone = onDone;
  $('scenespeaker').textContent = sc.speaker;
  $('sceneline').textContent = sc.lines[0];
  $('scenenext').textContent = sc.lines.length > 1 ? '…' : '— ok —';
  $('sceneskip').style.display = onDone ? '' : 'none';   // skip only on the one-off intro
  $('scene').classList.add('show');
}
$('sceneskip').addEventListener('pointerup', () => {
  $('scene').classList.remove('show');
  $('sceneskip').style.display = 'none';
  const cb = sceneDone; sceneDone = null; sceneQ = null;
  if (cb) cb();
});
$('scenenext').addEventListener('pointerup', () => {
  sceneI++;
  if (sceneQ && sceneI < sceneQ.lines.length) {
    $('sceneline').textContent = sceneQ.lines[sceneI];
    $('scenenext').textContent = sceneI < sceneQ.lines.length - 1 ? '…' : '— ok —';
    sfx.ui();
  } else {
    $('scene').classList.remove('show');
    if (sceneDone) {           // a one-off scene (e.g. the escape intro) with a callback
      $('sceneskip').style.display = 'none';
      const cb = sceneDone; sceneDone = null; sceneQ = null;
      cb();
      return;
    }
    meta.storySeen.push(sceneQ.id);
    saveAll();
    const more = nextScene();
    if (more) playScene(more);
  }
});
$('boardheal').addEventListener('pointerup', () => {
  if (!run || run.healCharges <= 0) return;
  run.healCharges--;
  run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * 0.4));
  sfx.pdodge(); saveAll(); openBoard();
});
$('beginbtn').addEventListener('pointerup', () => {
  $('den').classList.remove('show');
  newRun();
});
$('gallerybtn').addEventListener('pointerup', () => {
  const grid = $('gallerygrid');
  grid.innerHTML = '';
  let known = 0;
  for (const [id, F] of Object.entries(FORMS)) {
    const k = meta.gallery[id] || F.base && meta.starters.includes(F.cryptid);
    if (k) known++;
    const cell = document.createElement('div');
    cell.className = 'formcell' + (k ? ' known' : '');
    cell.innerHTML = `${k ? '◆' : '◇'}<span class="fname">${k ? F.name : '???'}</span>`;
    grid.appendChild(cell);
  }
  $('gallerysub').textContent = `${known}/20 forms lived-in`;
  $('gallery').classList.add('show');
  sfx.ui();
});
$('galleryclose').addEventListener('pointerup', () => $('gallery').classList.remove('show'));
$('densparbtn').addEventListener('pointerup', () => {
  $('den').classList.remove('show');
  $('practicebtn').dispatchEvent(new PointerEvent('pointerup'));
});

// ---------- achievements ----------
function award(id) {
  if (meta.achievements[id]) return;
  meta.achievements[id] = true;
  const A = ACHIEVEMENTS.find((a) => a.id === id);
  showToast(`🏆 ${A.name} — ${A.unlock}`);
  sfx.pdodge();
  saveAll();
}
const prog = () => (meta.achProgress = meta.achProgress || {});
function checkMissionAchievements(missionType) {
  const P = prog();
  if (world.player.pdodges >= 10) award('gutterreflexes');
  if (!world._tookHit) award('untouchable');
  if (missionType === 'sabotage') {
    P.sabotages = (P.sabotages || 0) + 1;
    if (P.sabotages >= 5) award('wreckingcrew');
  }
  if ((P.potions || 0) >= 15) award('barbrawler');
  if ((P.interrupts || 0) >= 25) award('readtheroom');
  if ((P.stanceDmg || 0) >= 300) award('oldgrudges');
}
const gatedOk = () => {
  const set = new Set();
  if (meta.achievements.untouchable) set.add('afterimage');
  if (meta.achievements.oldgrudges) set.add('feralpact');
  if (meta.achievements.exactchange) set.add('luckypaw');
  return set;
};

// ---------- the mission board ----------
const ESSENCE_ICON = { static: '⚡', rain: '🌧', rust: '⚙', moon: '🌙' };
function openBoard() {
  mode = 'board';
  setIntensity(0.35);
  if (coach.on) { coach.on = false; $('coach').classList.remove('show'); }
  const list = $('missions');
  list.innerHTML = '';
  const blind = run.pursuit >= 8;          // Off the Grid — you route on type alone
  for (const m of run.board) {
    const done = run.cleared.includes(m.id) || run.failed.includes(m.id);
    const locked = m.locked && !done;      // Lockdown — padlocked, no route through it
    const card = document.createElement('button');
    card.className = 'mission' + (done ? ' done' : '') + (locked ? ' locked' : '');
    card.innerHTML = `
      <span class="mtype">${MISSION_TYPES[m.type].icon} ${MISSION_TYPES[m.type].name}</span>
      <strong>${locked ? '🔒 padlocked' : (blind ? '???' : m.arena)}</strong>
      <em>${locked ? 'Lockdown. This route is sealed tonight.' : (blind ? 'Off the grid — you’ll only know when you arrive.' : m.flavor)}</em>
      <span class="mdanger">${blind && !done ? '✦?' : '✦'.repeat(m.danger)}${done ? ' · CLEARED' : ''}</span>`;
    if (!done && !locked) {
      card.addEventListener('pointerup', () => enterMission(m.id));
    }
    list.appendChild(card);
  }
  // the act hunter card — or, past act 3, THE KEEPER
  const boss = document.createElement('button');
  if (run.stage === 'keeper') {
    boss.className = 'mission boss';
    boss.innerHTML = `
      <span class="mtype">⛓ THE FACILITY</span>
      <strong>THE KEEPER</strong>
      <em>The gate is open. The atrium waits. They will be terribly polite about it.</em>
      <span class="mdanger">✦✦✦✦</span>`;
    boss.addEventListener('pointerup', enterKeeper);
  } else {
    const ready = bossReady(run);
    boss.className = 'mission boss' + (ready ? '' : ' locked');
    const H = hunterFor(run);
    boss.innerHTML = `
      <span class="mtype">☠ ACT ${run.act} HUNTER</span>
      <strong>${H.name}</strong>
      <em>${ready ? 'They know you’re coming. Go anyway.' : `Clear ${CLEAR_TO_BOSS - clearedCount(run)} more mission${CLEAR_TO_BOSS - clearedCount(run) === 1 ? '' : 's'} to force the appointment.`}</em>
      <span class="mdanger">${'✦'.repeat(3)}</span>`;
    if (ready) boss.addEventListener('pointerup', enterBoss);
  }
  list.appendChild(boss);

  const heal = $('boardheal');
  heal.style.display = run.healCharges > 0 && run.hp < run.maxHp ? '' : 'none';
  heal.textContent = `🛢 patch up (${run.healCharges} left)`;
  $('boardsub').textContent =
    `HP ${run.hp}/${run.maxHp} · Lv ${run.level} · ` +
    Object.entries(run.essence).filter(([, v]) => v > 0).map(([k, v]) => `${ESSENCE_ICON[k]}${v}`).join(' ') || '';
  $('boardact').textContent = `ACT ${run.act} — ${['the outer yards', 'the deep city', 'the facility ring'][run.act - 1]}`;
  $('board').classList.add('show');
}

function syncPlayerFromRun() {
  world.gatedOk = gatedOk();
  world.sparEchoes = !!meta.achievements.named;
  applyForm(world, run.form);
  const p = world.player;
  for (const mv of p.moves) mv.tier = run.moveTiers[mv.id] || 0;
  p.maxHp = run.maxHp;
  p.hp = Math.min(run.hp, run.maxHp);
  if (run.attuned) { p.dmgMult *= 1.08; world.attuned = true; }
  refreshMoveButtons();
}

// ability buttons show the current kit's move names
let btnFormKey = '';
function refreshMoveButtons() {
  const key = run ? run.form + ':' + JSON.stringify(run.moveTiers) : 'none';
  if (key === btnFormKey) return;
  btnFormKey = key;
  const kit = run ? FORMS[run.form].kit : [];
  for (let i = 0; i < 3; i++) {
    const btn = $(`ab${i + 1}btn`);
    const id = kit[i];
    if (id) {
      const tier = (run.moveTiers[id] || 0);
      btn.querySelector('.lbl').textContent = MOVES[id].name.split(' ')[0].slice(0, 6).toUpperCase();
      btn.title = `${MOVES[id].name}${tier ? ' T' + (tier + 1) : ''}`;
    }
  }
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
  world.pursuit = pursuitFlags(run.pursuit);
  syncPlayerFromRun();
  startMission(world, m);
  $('board').classList.remove('show');
  mode = 'fight';
  setIntensity(0.7);
  sfx.ui();
  if (!meta.coachDone) startCoach();
}

function enterBoss() {
  world = createWorld(run.seed * 977 + run.act);
  world.actNum = run.act;
  world.pursuit = pursuitFlags(run.pursuit);
  syncPlayerFromRun();
  startTrainer(world, hunterFor(run), run.act);
  $('board').classList.remove('show');
  mode = 'fight';
  setIntensity(1.0);
  sfx.ui();
}

function enterKeeper() {
  world = createWorld(run.seed * 3301);
  world.actNum = 3;
  world.pursuit = pursuitFlags(run.pursuit);
  syncPlayerFromRun();
  startKeeper(world, KEEPER, run.starter);
  $('board').classList.remove('show');
  mode = 'fight';
  setIntensity(1.0);
  sfx.ui();
}

// ---------- mission end / defeat / victory ----------
function onMissionComplete() {
  const m = missionById(run, run.atMission);
  syncRunFromWorld();
  checkMissionAchievements(m ? m.type : 'bout');
  meta.denTokens += 1;
  let line = 'Cleared. Back to the hideout. (+1 ⬡)';
  if (m && m.type === 'rescue') {
    if (meta.starters.length < 4) {
      const next = RESCUE_ORDER[meta.starters.length - 1];
      meta.starters.push(next);
      if (next === 'dent') award('exactchange');
      line = `You freed ${CRYPTID_NAMES[next]} — a new starter waits at the den!`;
      screenFlash(0.5, '62,230,210');
    } else {
      meta.denFriends.push('freed-' + (meta.denFriends.length + 1));
      line = 'Another one free. The den grows louder. (+1 ⬡)';
    }
  }
  completeMission(run, run.atMission);
  saveAll();
  setTimeout(() => afterFightRewards(line), 900);
}

// the reward chain: attunement -> upgrade offer -> evolution -> board
function afterFightRewards(toastText) {
  if (run && needsAttune(run)) {
    const name = attune(run);
    showToast(`⭐ ATTUNED — ${name} deepens.`);
    saveAll();
  }
  const offer = run ? upgradeOffer(run) : [];
  if (offer.length) {
    openUpgrade(offer, () => {
      if (run && needsEvolution(run)) openEvolve();
      else { if (toastText) showToast(toastText); openBoard(); }
    });
  } else if (run && needsEvolution(run)) {
    openEvolve();
  } else {
    if (toastText) showToast(toastText);
    openBoard();
  }
}

function openUpgrade(offer, done) {
  mode = 'board';
  const list = $('upchoices');
  list.innerHTML = '';
  for (const o of offer) {
    const card = document.createElement('button');
    card.className = 'mission';
    card.innerHTML = `<span class="mtype">${EICON[MOVES[o.id].essence]} UPGRADE</span>
      <strong>${o.name}</strong>
      <em>tier ${o.from + 1} → ${o.from + 2}</em>`;
    card.addEventListener('pointerup', () => {
      applyUpgrade(run, o.id);
      saveAll(); sfx.pdodge();
      $('upgrade').classList.remove('show');
      done();
    });
    list.appendChild(card);
  }
  const skip = document.createElement('button');
  skip.className = 'smallbtn';
  skip.textContent = 'keep as is';
  skip.addEventListener('pointerup', () => { $('upgrade').classList.remove('show'); done(); });
  list.appendChild(skip);
  $('upgrade').classList.add('show');
}

function openEvolve() {
  mode = 'board';
  const offer = evolutionOffer(run, 2);
  const list = $('evochoices');
  list.innerHTML = '';
  for (const F of offer) {
    const known = !!meta.gallery[Object.keys(FORMS).find(k => FORMS[k] === F)];
    const formId = Object.keys(FORMS).find(k => FORMS[k] === F);
    const card = document.createElement('button');
    card.className = 'mission evo';
    card.innerHTML = `<span class="mtype">${EICON[F.essence]} ${F.essence.toUpperCase()} · ${EICON[F.essence]}${run.essence[F.essence]} gathered</span>
      <strong>${known ? F.name : F.name}</strong>
      <em>${ESSENCE_STYLE[F.essence]}${F.hint ? ' — ' + (known ? F.hint : '???') : ''}</em>
      <span class="mdanger">${known ? 'you have been this before' : 'undiscovered form'}</span>`;
    card.addEventListener('pointerup', () => {
      evolve(run, formId);
      meta.gallery[formId] = true;
      saveAll();
      sfx.pdodge();
      screenFlash(0.5, '62,230,210');
      $('evolve').classList.remove('show');
      showToast(`You are ${F.name} now.`);
      openBoard();
    });
    list.appendChild(card);
  }
  $('evolve').classList.add('show');
}

function onBossDown() {
  syncRunFromWorld();
  meta.denTokens += 3 + (meta.achievements.longwayround ? 1 : 0);
  if (run.act === 2) { // about to enter act 3
    prog().act3Times = (prog().act3Times || 0) + 1;
    if (prog().act3Times >= 5) award('longwayround');
  }
  // Pursuit 4 — Rationing: the after-boss patch-up is halved.
  const healFrac = HEAL_AFTER_BOSS * (run.pursuit >= 4 ? 0.5 : 1);
  run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * healFrac));
  if (run.perks && run.perks.rainbarrel) run.healCharges = 1;
  const wasAct = run.act;
  const result = completeBoss(run);
  // Pursuit 6 — The Understudy: the Keeper checks your form between acts 2 and 3.
  const understudy = run.pursuit >= 6 && result === 'next' && wasAct === 2;
  if (understudy) {
    run.hp = Math.max(1, Math.round(run.hp * 0.6));
    saveAll();
    setTimeout(() => playScene({
      id: 'understudy', speaker: 'THE KEEPER',
      lines: [
        '“There you are. No, no — don’t stop on my account. Just checking your form.”',
        '“A little soft in the middle. We’ll fix that at home. Off you pop.”',
      ],
    }, () => afterFightRewards('The Keeper let you pass — lighter, and colder for it.')), 1200);
    return;
  }
  if (result === 'keeper') {
    saveAll();
    setTimeout(() => afterFightRewards('The last hunter is gone. Only the facility remains — and the one who runs it.'), 1200);
  } else {
    saveAll();
    setTimeout(() => afterFightRewards(`Act ${run.act - 1} cleared — the city opens. Patched up a little.`), 1200);
  }
}

function onKeeperDown() {
  const starter = run.starter;
  meta.wins++; meta.runs++;
  // clearing at the highest unlocked Pursuit rung unlocks the next
  if (run.pursuit >= (meta.pursuitBest || 0)) meta.pursuitBest = Math.min(8, (meta.pursuitBest || 0) + 1);
  run = null;
  SAVE.clearRun(meta, { muted: isMuted() });
  setTimeout(() => {
    $('winsub').textContent = (KEEPER.lines.defeated[starter] || KEEPER.lines.defeated.snig) +
      ' — You walk out through the front door. The rain, for once, feels like applause.';
    $('victory').classList.add('show');
    mode = 'board';
  }, 1400);
}

const defeatStats = { kos: 0, bestCombo: 0 };
function showDefeat(cause) {
  if (coach.on) { coach.on = false; $('coach').classList.remove('show'); }
  meta.runs++;
  if (world.trainer) {
    const id = world.trainer.def.id;
    const P = prog();
    P.deathsBy = P.deathsBy || {};
    P.deathsBy[id] = (P.deathsBy[id] || 0) + 1;
    if (P.deathsBy[id] >= 2) award('repeatoffender');
  }
  if (world.keeper) award('named');
  if ((prog().stanceDmg || 0) >= 300) award('oldgrudges');
  const reached = run ? `Reached: act ${run.act}, ${run.missionsDone} missions in.` : '';
  run = null;
  SAVE.clearRun(meta, { muted: isMuted() });
  $('defcause').textContent = `Caught by ${cause}.`;
  $('defstats').textContent = `${reached} Foes felled: ${defeatStats.kos} · best combo ×${defeatStats.bestCombo} · perfect dodges: ${world.player.pdodges}`;
  $('defeat').classList.add('show');
}
$('againbtn').addEventListener('pointerup', () => {
  $('defeat').classList.remove('show');
  openDen();
});
$('winbtn').addEventListener('pointerup', () => {
  $('victory').classList.remove('show');
  openDen();
});

// Pursuit rules → combat flags (inert unless the run opted in). Cumulative.
function pursuitFlags(level) {
  if (!level) return null;
  return {
    spotters: level >= 1,
    curfew: level >= 3,
    ration: level >= 4,
    marked: level >= 5,
  };
}

function newRun() {
  const lvl = Math.min(meta.pursuitNext || 0, meta.pursuitBest || 0);
  run = createRun((Math.random() * 1e9) | 0, denStarter, { ...meta.powerTrack }, lvl);
  defeatStats.kos = 0; defeatStats.bestCombo = 0;
  saveAll();
  sfx.ui();
  if (lvl > 0) showToast(`PURSUIT ${lvl} — the rules stack against you.`);
  openBoard();
}

// ---------- sim events -> juice ----------
function handleEvents() {
  for (const ev of world.events) {
    if (coach.on) coachNote(ev.t);
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
        if (world.keeper) onKeeperDown();
        break;
      case 'trainer_start': showToast(ev.line); sfx.tell(); addTrauma(0.2); break;
      case 'trainer_line': showToast(ev.line); break;
      case 'trainer_send': sfx.tell(); break;
      case 'trainer_fled': showToast(ev.line); sfx.foeDown(); screenFlash(0.4, '224,95,208'); break;
      case 'trainer_gone': onBossDown(); break;
      case 'keeper_start': showToast(ev.line); sfx.tell(); addTrauma(0.3); break;
      case 'keeper_line': showToast(ev.line); sfx.tell(); break;
      case 'keeper_beat': showToast(ev.line); setIntensity(0.15); break;
      case 'keeper_beat_end': setIntensity(1.0); break;
      case 'fence': sfx.slam(); addTrauma(0.4); showToast('The fences rise.'); break;
      case 'gadget': sfx.ui(); break;
      case 'ball_thrown': sfx.tell(); break;
      case 'balled':
        sfx.hurt(); addTrauma(0.4);
        showToast('CAUGHT IN THE BALL — MASH EVERYTHING!');
        break;
      case 'struggle': break;
      case 'break_free':
        sfx.pdodge(); screenFlash(0.4, '62,230,210');
        floatText(ev.x, ev.y, 'BROKE FREE', { color: '#3ee6d2', size: 20, crit: true });
        break;
      case 'rooted': showToast('Snared — mash to tear loose!'); sfx.hurt(); break;
      case 'armorbreak':
        sfx.slam(); hitStop(0.1); addTrauma(0.3);
        floatText(ev.x, ev.y, 'ARMOR BREAK', { color: '#ffb347', size: 18, crit: true });
        break;
      case 'clink': sfx.blocked(); floatText(ev.x, ev.y, 'clink', { color: '#776a85', size: 12 }); break;
      case 'warded': sfx.blocked(); floatText(ev.x, ev.y, 'warded', { color: '#9fc4e8', size: 12 }); break;
      case 'toll': sfx.tell(); showToast('The bell tolls — the pack quickens! Silence it!'); break;
      case 'smashed':
        sfx.hit(true); burst(ev.x, ev.y, 10, { color: '#ffe08a', speed: 160, grav: 200 });
        if (ev.kind === 'potion') {
          prog().potions = (prog().potions || 0) + 1;
          if (meta.achievements.barbrawler) world.pickups.push({ x: ev.x, y: 460, heal: 6 });
        }
        break;
      case 'eshoot': sfx.tell(); break;
      case 'foe_healed': floatText(ev.x, ev.y, '+heal', { color: '#ff8fa3', size: 13 }); break;
      case 'cage_open':
        sfx.pdodge(); screenFlash(0.35, '62,230,210');
        floatText(ev.x, 400, 'FREE!', { color: '#3ee6d2', size: 20, crit: true });
        break;
      case 'friend_hurt': sfx.hurt(); addTrauma(0.2); break;
      case 'ambush': showToast('Ambush!'); sfx.tell(); break;
      case 'mission_failed':
        sfx.defeat();
        run.failed.push(run.atMission);
        run.atMission = null;
        syncRunFromWorld();
        saveAll();
        setTimeout(() => { showToast('You got out. It didn’t. The board remembers.'); openBoard(); }, 1200);
        break;
      case 'whipcrack': sfx.slam(); addTrauma(0.2); break;
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
        world._tookHit = true;
        if (world.player.bide || world.player.furyOn) prog().stanceDmg = (prog().stanceDmg || 0) + ev.dmg;
        floatText(ev.x, ev.y, `-${ev.dmg}`, { color: '#ff8fa3', size: 20 });
        break;
      case 'blocked': sfx.blocked(); floatText(ev.x, ev.y, 'blocked', { color: '#9fc4e8', size: 14 }); break;
      case 'ability': sfx.ability(); floatText(ev.x, ev.y, ev.name, { color: '#b8fff2', size: 14 }); break;
      case 'interrupt':
        sfx.interrupt(); hitStop(0.1);
        prog().interrupts = (prog().interrupts || 0) + 1;
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

// ---------- coach: one-time on-screen control hints, first real fight ----------
// Each step clears itself the moment the player DOES the thing — teaching by doing,
// never a wall of text. Fully skippable (it just fades as you play).
const COACH_STEPS = [
  { hint: 'DRAG the left side to MOVE', sub: 'your thumb is the stick' },
  { hint: 'TAP <b>A</b> to STRIKE', sub: 'again · again · again — a combo' },
  { hint: 'DASH to slip through a hit', sub: 'time it and everything slows' },
  { hint: 'JUMP, then <b>A</b> in the air', sub: 'launch ↑+A, then juggle' },
];
const coach = { on: false, i: 0, startX: 0, holdT: 0, done: {} };
function startCoach() {
  coach.on = true; coach.i = 0; coach.holdT = 0;
  coach.startX = world.player.x; coach.done = {};
  meta.coachDone = true; saveAll();   // one-and-done: never re-arm on a later mission
  showCoach();
}
function showCoach() {
  const c = COACH_STEPS[coach.i];
  const el = $('coach');
  if (!c) { el.classList.remove('show'); coach.on = false; meta.coachDone = true; saveAll(); return; }
  el.innerHTML = `${c.hint}<small>${c.sub}</small>`;
  el.classList.add('show');
}
function coachAdvance() {
  coach.i++; coach.holdT = 0;
  const el = $('coach');
  el.classList.remove('show');
  setTimeout(showCoach, 260);
}
// fired from handleEvents when the player performs an action
function coachNote(kind) {
  if (!coach.on) return;
  if (coach.i === 1 && kind === 'swing') coach.done.swing = true;
  if (coach.i === 2 && kind === 'dash') coach.done.dash = true;
  if (coach.i === 3 && kind === 'jump') coach.done.jump = true;
}
function updateCoach(dt) {
  if (!coach.on) return;
  coach.holdT += dt;
  let cleared = false;
  if (coach.i === 0 && Math.abs(world.player.x - coach.startX) > 70) cleared = true;
  else if (coach.i === 1 && coach.done.swing) cleared = true;
  else if (coach.i === 2 && coach.done.dash) cleared = true;
  else if (coach.i === 3 && coach.done.jump) cleared = true;
  // never nag: if a step lingers, let it fade on its own after a while
  if (!cleared && coach.holdT > 14) cleared = true;
  if (cleared) coachAdvance();
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
    updateCoach(dt);
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
  if (run) { openBoard(); return; }
  if (!meta.tutorialSeen) {
    meta.tutorialSeen = true; saveAll();
    playScene(INTRO, openDen);      // the escape night, once — then home
  } else openDen();
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
