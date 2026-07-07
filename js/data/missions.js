// Mission templates + per-act wave tables. All content, no logic.
// M2 ships BOUT and SABOTAGE; RESCUE/ESCORT/CHASE arrive with the trainers (M4).
// Danger 1-3 shows on the board; reward hints are honest.

// wave entries: arrays of {species, x} spawned relative to arena width (x: 0..1)
export const WAVES = {
  act1: [
    [{ s: 'skitterlin', x: 0.75 }, { s: 'skitterlin', x: 0.85 }],
    [{ s: 'growler', x: 0.8 }, { s: 'skitterlin', x: 0.9 }],
    [{ s: 'growler', x: 0.15 }, { s: 'growler', x: 0.85 }],
  ],
  act2: [
    [{ s: 'growler', x: 0.8 }, { s: 'skitterlin', x: 0.7 }, { s: 'skitterlin', x: 0.9 }],
    [{ s: 'growler', x: 0.1 }, { s: 'growler', x: 0.85 }, { s: 'skitterlin', x: 0.95 }],
    [{ s: 'growler', x: 0.15 }, { s: 'growler', x: 0.8 }, { s: 'growler', x: 0.9 }],
  ],
  act3: [
    [{ s: 'growler', x: 0.8 }, { s: 'growler', x: 0.15 }, { s: 'skitterlin', x: 0.9 }],
    [{ s: 'growler', x: 0.1 }, { s: 'growler', x: 0.2 }, { s: 'growler', x: 0.85 }],
    [{ s: 'growler', x: 0.1 }, { s: 'growler', x: 0.9 }, { s: 'growler', x: 0.8 }, { s: 'skitterlin', x: 0.2 }],
  ],
};

// arena skins (render flavors) — the city gets stranger as you climb
export const ARENAS = {
  act1: ['the loading dock', 'the laundrette alley', 'the canal walk', 'the bus depot'],
  act2: ['the car park, level 3', 'the neon high street', 'the scrap market', 'the rail arches'],
  act3: ['the museum steps', 'the rooftop line', 'the old chapel yard', 'the facility approach'],
};

export const MISSION_TYPES = {
  rescue: {
    name: 'RESCUE',
    icon: '⛓',
    flavor: [
      'Cages in the yard. You remember cages.',
      'Two locks. Guards on rotation. One very motivated dragon.',
      'Someone in there has been waiting a long time.',
    ],
  },
  escort: {
    name: 'ESCORT',
    icon: '➔',
    flavor: [
      'The little one can’t fight. You can.',
      'Walk them to the fence line. All of them come back or none.',
      'It follows you now. Terrifying responsibility.',
    ],
  },
  chase: {
    name: 'THE CHASE',
    icon: '»',
    flavor: [
      'A Bloodhound Unit has your scent. Outrun the warranty.',
      'Do not stop. Do not look back. Smash the fences.',
      'Ninety seconds of being faster than yesterday.',
    ],
  },
  bout: {
    name: 'BOUT',
    icon: '⚔',
    flavor: [
      'Their monsters hold this block. Un-hold it.',
      'A welcoming committee. How thoughtful.',
      'Three waves, no manners.',
    ],
  },
  sabotage: {
    name: 'SABOTAGE',
    icon: '✕',
    flavor: [
      'Smash the relay pylons. The hunters see through them.',
      'Their gear charges here. It would be a shame if it didn’t.',
      'Break the machines. Politely, if you must.',
    ],
  },
};

// placeholder act bosses until the trainer pool lands in M4.
// FLAT authored stats per act — never level-scaled (the cutefight lesson).
export const ACT_BOSSES = {
  1: { name: 'the Warden Hound', species: 'growler', hp: 150, dmg: 14, scale: 1.35, tell: 0.6, adds: ['skitterlin'] },
  2: { name: 'the Yard Alpha', species: 'growler', hp: 240, dmg: 16, scale: 1.5, tell: 0.5, adds: ['skitterlin', 'growler'] },
  3: { name: 'the Gatekeeper', species: 'growler', hp: 360, dmg: 18, scale: 1.65, tell: 0.45, adds: ['growler', 'growler'] },
};

export const HEAL_AFTER_BOSS = 0.35; // fraction of max HP restored when an act falls
