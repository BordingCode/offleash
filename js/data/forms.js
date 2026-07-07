// The 20 playable forms: 4 cryptids × (base + 4 essence evolutions).
// Every form is a FIXED 3-move kit (ids into moves.js, each starting at tier 0;
// mission rewards raise tiers of KNOWN moves). Stat leans per essence:
// STATIC +speed −HP · RAIN mid + counters · RUST +HP/poise −speed · MOON air.
// sprite: key into buildSprites() (falls back to the base cryptid's art + an
// essence tint until its art is authored).
export const FORMS = {
  // ---------------- SNIG — the drainpipe dragon (balanced) ----------------
  snig: { name: 'SNIG', base: true, cryptid: 'snig', sprite: 'snig',
    kit: ['umbrella', 'cheapshot', 'rupture'],
    stats: { hp: 100, spd: 1, dmg: 1 } },
  fusewyrm: { name: 'FUSEWYRM', cryptid: 'snig', essence: 'static', sprite: 'fusewyrm',
    hint: 'a blur with a lightning-rod horn',
    kit: ['blinkstep', 'ghostwire', 'staticsnare'],
    stats: { hp: 92, spd: 1.18, dmg: 1 } },
  sluice: { name: 'SLUICE', cryptid: 'snig', essence: 'rain', sprite: 'sluice',
    hint: 'the patient current that wins',
    kit: ['umbrella', 'siphonfang', 'vortex'],
    stats: { hp: 108, spd: 1, dmg: 1 } },
  mainswyrm: { name: 'MAINSWYRM', cryptid: 'snig', essence: 'rust', sprite: 'mainswyrm',
    hint: 'pipe-armored, unreasonable',
    kit: ['rupture', 'whetstone', 'undergrate'],
    stats: { hp: 124, spd: 0.88, dmg: 1.12 } },
  eavedrake: { name: 'EAVEDRAKE', cryptid: 'snig', essence: 'moon', sprite: 'eavedrake',
    hint: 'the rooftops belong to it now',
    kit: ['zerog', 'moonhop', 'cheapshot'],
    stats: { hp: 96, spd: 1.05, dmg: 1 } },

  // ---------------- WICK — the living shadow (fast, fragile) ----------------
  wick: { name: 'WICK', base: true, cryptid: 'wick', sprite: 'wick',
    kit: ['blinkstep', 'payback', 'jamsignal'],
    stats: { hp: 82, spd: 1.22, dmg: 0.92 } },
  strobe: { name: 'STROBE', cryptid: 'wick', essence: 'static', sprite: 'strobe',
    hint: 'seen only between frames',
    kit: ['blinkstep', 'overclock', 'flashbulb'],
    stats: { hp: 76, spd: 1.38, dmg: 0.9 } },
  mirrorwick: { name: 'MIRRORWICK', cryptid: 'wick', essence: 'rain', sprite: 'mirrorwick',
    hint: 'hit it and meet yourself',
    kit: ['payback', 'mirrorveil', 'litterdecoy'],
    stats: { hp: 88, spd: 1.15, dmg: 0.95 } },
  tarwick: { name: 'TARWICK', cryptid: 'wick', essence: 'rust', sprite: 'tarwick',
    hint: 'a shadow that learned to hold a grudge',
    kit: ['coldreceipt', 'rustveil', 'jamsignal'],
    stats: { hp: 96, spd: 1.05, dmg: 1.05 } },
  nocturne: { name: 'NOCTURNE', cryptid: 'wick', essence: 'moon', sprite: 'nocturne',
    hint: 'the night, with opinions',
    kit: ['afterimage', 'curfewbell', 'blinkstep'],
    stats: { hp: 84, spd: 1.25, dmg: 0.92 } },

  // ---------------- PHOSSA — the lamplight moth (aerial) ----------------
  phossa: { name: 'PHOSSA', base: true, cryptid: 'phossa', sprite: 'phossa',
    kit: ['moonhop', 'flashbulb', 'lullaby'],
    stats: { hp: 88, spd: 1.08, dmg: 0.95, jumps: 3 } },
  arcflit: { name: 'ARCFLIT', cryptid: 'phossa', essence: 'static', sprite: 'arcflit',
    hint: 'a spark that refuses to land',
    kit: ['pistonjab', 'flashbulb', 'livewire'],
    stats: { hp: 82, spd: 1.25, dmg: 0.95, jumps: 3 } },
  mistwing: { name: 'MISTWING', cryptid: 'phossa', essence: 'rain', sprite: 'mistwing',
    hint: 'wings you only hear',
    kit: ['cloudburst', 'leechburr', 'umbrella'],
    stats: { hp: 94, spd: 1.05, dmg: 0.95, jumps: 3 } },
  ironmoth: { name: 'IRONMOTH', cryptid: 'phossa', essence: 'rust', sprite: 'ironmoth',
    hint: 'soot-plated; the city changed it',
    kit: ['rustscreech', 'scrapplating', 'moonhop'],
    stats: { hp: 104, spd: 0.95, dmg: 1.05, jumps: 2 } },
  palewing: { name: 'PALEWING', cryptid: 'phossa', essence: 'moon', sprite: 'palewing',
    hint: 'the moth the moon answers',
    kit: ['zerog', 'lullaby', 'lastaria'],
    stats: { hp: 86, spd: 1.1, dmg: 1, jumps: 4 } },

  // ---------------- DENT — the vending-machine mimic (tank) ----------------
  dent: { name: 'DENT', base: true, cryptid: 'dent', sprite: 'dent',
    kit: ['scrapplating', 'coldreceipt', 'grudgecoil'],
    stats: { hp: 130, spd: 0.82, dmg: 1.15 } },
  joltcrate: { name: 'JOLTCRATE', cryptid: 'dent', essence: 'static', sprite: 'joltcrate',
    hint: 'do not insert coins',
    kit: ['blownfuse', 'staticsnare', 'pistonjab'],
    stats: { hp: 118, spd: 0.92, dmg: 1.15 } },
  slushfund: { name: 'SLUSHFUND', cryptid: 'dent', essence: 'rain', sprite: 'slushfund',
    hint: 'pays out when provoked',
    kit: ['stormnap', 'grudgecoil', 'glassward'],
    stats: { hp: 138, spd: 0.8, dmg: 1.1 } },
  scrapbank: { name: 'SCRAPBANK', cryptid: 'dent', essence: 'rust', sprite: 'scrapbank',
    hint: 'a vault that hits back',
    kit: ['heldbreath', 'scrapplating', 'caltrops'],
    stats: { hp: 150, spd: 0.75, dmg: 1.25 } },
  ghostvend: { name: 'GHOSTVEND', cryptid: 'dent', essence: 'moon', sprite: 'ghostvend',
    hint: 'decommissioned; disagrees',
    kit: ['junkroll', 'moonhop', 'curfewbell'],
    stats: { hp: 122, spd: 0.9, dmg: 1.12 } },
};

export const CRYPTID_BASE = { snig: 'snig', wick: 'wick', phossa: 'phossa', dent: 'dent' };

// evolution directions per cryptid (the offer at Lv 6 picks from these)
export function formsFor(cryptid) {
  return Object.values(FORMS).filter((f) => f.cryptid === cryptid && !f.base);
}

export const EVOLVE_LEVEL = 6;
export const ATTUNE_LEVEL = 10;
