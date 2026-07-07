// Run state: the escape attempt itself. Seeded board generation, 3 acts,
// clear 3 of 5 to draw out the act boss. Pure logic — no DOM.
import { mulberry32 } from './world.js';
import { WAVES, ARENAS, MISSION_TYPES, ACT_BOSSES } from '../data/missions.js';
import { FORMS, formsFor, EVOLVE_LEVEL, ATTUNE_LEVEL } from '../data/forms.js';
import { MOVES } from '../data/moves.js';

export const MISSIONS_PER_ACT = 5;
export const CLEAR_TO_BOSS = 3;

export function createRun(seed, starter = 'snig') {
  const run = {
    seed,
    starter,
    form: starter,       // current form id (base until the Lv-6 evolution)
    moveTiers: {},       // moveId -> earned tier (persists across evolution)
    attuned: false,      // the Lv-10 attunement
    act: 1,
    board: [],
    cleared: [],
    bossDown: [],
    xp: 0, level: 1,
    essence: { static: 0, rain: 0, rust: 0, moon: 0 },
    hp: FORMS[starter].stats.hp, maxHp: FORMS[starter].stats.hp,
    missionsDone: 0,
    atMission: null,
  };
  run.board = genBoard(run);
  return run;
}

// max HP = the form's base + level growth
export function runMaxHp(run) {
  return Math.round(FORMS[run.form].stats.hp + 6 * (run.level - 1));
}

// ---------- evolution (Lv 6): offer directions weighted by gathered essence ----------
export const needsEvolution = (run) => run.level >= EVOLVE_LEVEL && FORMS[run.form].base;
export const needsAttune = (run) => run.level >= ATTUNE_LEVEL && !FORMS[run.form].base && !run.attuned;

export function evolutionOffer(run, choices = 2) {
  const dirs = formsFor(run.starter);
  // weight = essence gathered in that direction; ties keep a stable order via seed
  const rng = mulberry32(run.seed * 7 + 5);
  const jitter = new Map(dirs.map((f) => [f.essence, rng() * 0.5]));
  return [...dirs]
    .sort((a, b) => (run.essence[b.essence] + jitter.get(b.essence)) - (run.essence[a.essence] + jitter.get(a.essence)))
    .slice(0, choices);
}

export function evolve(run, formId) {
  const F = FORMS[formId];
  if (!F || F.cryptid !== run.starter || F.base) return false;
  const frac = run.hp / run.maxHp;
  run.form = formId;
  run.maxHp = runMaxHp(run);
  run.hp = Math.max(1, Math.round(run.maxHp * frac));
  return true;
}

// the Lv-10 attunement: signature (first kit slot) move jumps a tier + a glow
export function attune(run) {
  const sig = FORMS[run.form].kit[0];
  run.moveTiers[sig] = Math.min(2, (run.moveTiers[sig] || 0) + 1);
  run.attuned = true;
  return MOVES[sig].name;
}

// ---------- post-mission upgrade offer: tier-up 1 of 2 KNOWN moves ----------
export function upgradeOffer(run) {
  const rng = mulberry32(run.seed * 13 + run.missionsDone * 71);
  const known = FORMS[run.form].kit.filter((id) => (run.moveTiers[id] || 0) < 2);
  if (!known.length) return [];
  const picks = [];
  const pool = [...known];
  while (picks.length < 2 && pool.length) {
    picks.push(pool.splice((rng() * pool.length) | 0, 1)[0]);
  }
  return picks.map((id) => ({ id, name: MOVES[id].name, from: run.moveTiers[id] || 0 }));
}

export function applyUpgrade(run, moveId) {
  run.moveTiers[moveId] = Math.min(2, (run.moveTiers[moveId] || 0) + 1);
}

// deterministic per act: seed + act pick types, arenas, waves, danger
export function genBoard(run) {
  const rng = mulberry32(run.seed * 31 + run.act * 977);
  const arenas = [...ARENAS['act' + run.act]];
  const board = [];
  for (let i = 0; i < MISSIONS_PER_ACT; i++) {
    const type = i >= 3 || rng() < 0.65 ? 'bout' : 'sabotage'; // ≥1 sabotage likely, bouts dominate
    const T = MISSION_TYPES[type];
    const arena = arenas.splice((rng() * arenas.length) | 0, 1)[0] || 'the back lots';
    const waveSet = WAVES['act' + run.act];
    const wave = waveSet[(rng() * waveSet.length) | 0];
    const danger = 1 + ((rng() * 2.4) | 0) + (type === 'sabotage' ? 1 : 0);
    board.push({
      id: `a${run.act}m${i}`,
      type, arena,
      flavor: T.flavor[(rng() * T.flavor.length) | 0],
      danger: Math.min(3, danger),
      waves: buildWaves(run.act, wave, danger, rng),
      pylons: type === 'sabotage' ? 2 + (danger > 2 ? 1 : 0) : 0,
      arenaW: 1100 + ((rng() * 3) | 0) * 150,
    });
  }
  // guarantee at least one sabotage per act
  if (!board.some((mi) => mi.type === 'sabotage')) {
    const i = (rng() * board.length) | 0;
    board[i].type = 'sabotage';
    board[i].pylons = 2;
    board[i].flavor = MISSION_TYPES.sabotage.flavor[0];
  }
  return board;
}

function buildWaves(act, base, danger, rng) {
  // 2-3 waves built off the act table; danger adds a straggler
  const table = WAVES['act' + act];
  const n = 2 + (danger >= 2 ? 1 : 0);
  const waves = [];
  for (let i = 0; i < n; i++) {
    const src = table[(rng() * table.length) | 0];
    waves.push(src.map((e) => ({ ...e })));
  }
  if (danger >= 3) waves[waves.length - 1].push({ s: 'growler', x: 0.05 });
  return waves;
}

export const missionById = (run, id) => run.board.find((m) => m.id === id);
export const clearedCount = (run) => run.cleared.length;
export const bossReady = (run) => run.cleared.length >= CLEAR_TO_BOSS && !run.bossDown.includes(run.act);
export const actBoss = (run) => ACT_BOSSES[run.act];

export function completeMission(run, id) {
  if (!run.cleared.includes(id)) run.cleared.push(id);
  run.missionsDone++;
  run.atMission = null;
}

// the act boss fell — heal a little, move up a rung (or win the run)
export function completeBoss(run) {
  run.bossDown.push(run.act);
  if (run.act >= 3) return 'won';
  run.act++;
  run.cleared = [];
  run.board = genBoard(run);
  return 'next';
}

export function grantXp(run, amt) {
  run.xp += amt;
  const need = () => 40 + 30 * (run.level - 1);
  let leveled = false;
  while (run.xp >= need() && run.level < 12) {
    run.xp -= need();
    run.level++;
    run.maxHp = runMaxHp(run);
    run.hp = Math.min(run.maxHp, run.hp + 12);
    leveled = true;
  }
  return leveled;
}
