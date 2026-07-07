// Run state: the escape attempt itself. Seeded board generation, 3 acts,
// clear 3 of 5 to draw out the act boss. Pure logic — no DOM.
import { mulberry32 } from './world.js';
import { WAVES, ARENAS, MISSION_TYPES, ACT_BOSSES } from '../data/missions.js';

export const MISSIONS_PER_ACT = 5;
export const CLEAR_TO_BOSS = 3;

export function createRun(seed) {
  const run = {
    seed,
    act: 1,
    board: [],
    cleared: [],        // mission ids cleared this act
    bossDown: [],       // acts whose boss has fallen
    xp: 0, level: 1,
    essence: { static: 0, rain: 0, rust: 0, moon: 0 },
    hp: 100, maxHp: 100,
    missionsDone: 0,
    atMission: null,    // mission id if the app closed mid-mission (resume at its start)
  };
  run.board = genBoard(run);
  return run;
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

// xp: levels raise max HP a touch; the Lv-6 evolution offer arrives in M3
export function grantXp(run, amt) {
  run.xp += amt;
  const need = () => 40 + 30 * (run.level - 1);
  let leveled = false;
  while (run.xp >= need() && run.level < 12) {
    run.xp -= need();
    run.level++;
    run.maxHp += 6;
    run.hp = Math.min(run.maxHp, run.hp + 12);
    leveled = true;
  }
  return leveled;
}
