// offleash_save_v1 — meta persists forever; run persists between missions.
// Mid-mission quit resumes at that mission's START (we snapshot before entering).
// Death clears run, keeps meta: the run is the only cost.
const KEY = 'offleash_save_v1';

export function defaultMeta() {
  return {
    starters: ['snig'],
    denFriends: [],
    gallery: {},
    achievements: {},
    powerTrack: {},
    denTokens: 0,
    pursuitBest: 0,   // highest Pursuit level cleared (opt-in ladder after first win)
    pursuitNext: 0,   // Pursuit level chosen for the next run
    tutorialSeen: false,
    coachDone: false,   // the one-time on-screen control hints (first fight)
    wins: 0, runs: 0,
    storySeen: [],
  };
}

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s || s.v !== 1) return { meta: defaultMeta(), run: null, settings: {} };
    return { meta: { ...defaultMeta(), ...s.meta }, run: s.run || null, settings: s.settings || {} };
  } catch (e) {
    return { meta: defaultMeta(), run: null, settings: {} };
  }
}

export function save(meta, run, settings = {}) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, meta, run, settings }));
  } catch (e) {}
}

export function clearRun(meta, settings) {
  save(meta, null, settings);
}
