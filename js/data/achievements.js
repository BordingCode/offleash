// Achievements permanently enrich the pools — losing well still EARNS.
// check(meta, runStats) is evaluated at mission/run boundaries by main.js.
export const ACHIEVEMENTS = [
  { id: 'gutterreflexes', name: 'Gutter Reflexes', desc: '10 perfect dodges in one mission',
    unlock: 'Hoard & Hurl joins the RAIN pool' },
  { id: 'barbrawler', name: 'Bar Brawler', desc: 'Smash 15 potions mid-air (lifetime)',
    unlock: 'Smashed potions drop heal droplets' },
  { id: 'untouchable', name: 'Untouchable', desc: 'Clear a mission untouched',
    unlock: 'Neon Afterimage unlocks (NOCTURNE’s signature)' },
  { id: 'wreckingcrew', name: 'Wrecking Crew', desc: 'Complete 5 sabotage missions',
    unlock: 'Blown Fuse unlocks (JOLTCRATE’s nova)' },
  { id: 'oldgrudges', name: 'Old Grudges', desc: 'Absorb 300 damage in stances (lifetime)',
    unlock: 'Feral Pact unlocks' },
  { id: 'exactchange', name: 'Exact Change', desc: 'Free DENT',
    unlock: 'Lucky Paw unlocks' },
  { id: 'readtheroom', name: 'Read the Room', desc: 'Interrupt 25 telegraphs (lifetime)',
    unlock: 'Tier-3 upgrades can appear from Act 2' },
  { id: 'repeatoffender', name: 'Repeat Offender', desc: 'Fall to the same hunter twice',
    unlock: 'That hunter’s monsters gain louder tells (fairness, not mercy)' },
  { id: 'longwayround', name: 'Long Way Round', desc: 'Reach Act 3 five times',
    unlock: '+1 den token per act boss' },
  { id: 'named', name: 'Named', desc: 'Fall to THE KEEPER',
    unlock: 'The echo-constructs join the sparring yard' },
];

// which gated moves each achievement opens
export const GATE_UNLOCKS = {
  untouchable: 'afterimage',
  wreckingcrew: 'blownfuse_free', // blownfuse is ungated in kits; this marks the flavor
  oldgrudges: 'feralpact',
  exactchange: 'luckypaw',
  gutterreflexes: 'hoardhurl_free',
};
