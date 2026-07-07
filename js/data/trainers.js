// The hunter pool — 3 drawn per run as act bosses — and THE KEEPER.
// All stats are FLAT authored per-act rows (never scaled off player level).
// Voice: British-anime — dry wit, posh menace, perfectly composed.
// team rows: arrays of {s: species, hp, dmg} — hp/dmg override the bestiary.
// gadget: potion (arcing heal for their monster, SMASHABLE mid-air) · net (roots
// you, mash out) · drone (deploys a Snare Drone) · pylon (deploys a Ward Pylon)
// · reinforce (calls a Tinny) — thrown every `every` seconds between sends.
export const HUNTERS = [
  {
    id: 'auditor', name: 'Beatrix Quill, the Auditor',
    intro: '“Asset engagement, form 7-C. Do sign here with your face.”',
    taunt: '“Dodge number forty-one. I do hope you’re pacing yourself.”',
    flee: '“I shall mark this down as… a scheduling conflict.”',
    gadget: 'pylon', every: 9,
    team: {
      1: [{ s: 'bindler', hp: 40, dmg: 8 }, { s: 'growler', hp: 60, dmg: 12 }],
      2: [{ s: 'bindler', hp: 55, dmg: 10 }, { s: 'growler', hp: 75, dmg: 14 }, { s: 'wharfhag', hp: 70, dmg: 12 }],
      3: [{ s: 'bindler', hp: 65, dmg: 12 }, { s: 'wharfhag', hp: 90, dmg: 14 }, { s: 'growler', hp: 95, dmg: 16 }],
    },
  },
  {
    id: 'plumb', name: 'Major Plumb',
    intro: '“Talons at the ready! …That’s a figure of speech. They’re drones.”',
    taunt: '“My birds have brought down finer things than you, over better cities.”',
    flee: '“Tactical repositioning! It’s only cowardice if you stop shouting.”',
    gadget: 'drone', every: 11,
    team: {
      1: [{ s: 'sparkfly', hp: 26, dmg: 8 }, { s: 'sparkfly', hp: 26, dmg: 8 }],
      2: [{ s: 'sparkfly', hp: 34, dmg: 10 }, { s: 'moonjelly', hp: 50, dmg: 10 }, { s: 'sparkfly', hp: 34, dmg: 10 }],
      3: [{ s: 'sparkfly', hp: 40, dmg: 12 }, { s: 'moonjelly', hp: 65, dmg: 12 }, { s: 'sparkfly', hp: 40, dmg: 12 }],
    },
  },
  {
    id: 'vicar', name: 'the Vicar',
    intro: '“Terribly sorry about all this. Do try not to bleed on the flagstones.”',
    taunt: '“I’ll say a kind word over you afterwards. I’m told I’m rather good.”',
    flee: '“Consider yourself… forgiven. Provisionally.”',
    gadget: 'potion', every: 8,
    team: {
      1: [{ s: 'slabby', hp: 70, dmg: 12 }, { s: 'growler', hp: 55, dmg: 12 }],
      2: [{ s: 'slabby', hp: 95, dmg: 14 }, { s: 'bellwether', hp: 70, dmg: 10 }, { s: 'growler', hp: 70, dmg: 14 }],
      3: [{ s: 'slabby', hp: 120, dmg: 16 }, { s: 'bellwether', hp: 85, dmg: 12 }, { s: 'growler', hp: 90, dmg: 16 }],
    },
  },
  {
    id: 'nanny', name: 'Nanny Grit',
    intro: '“Sit still, pet. Nanny only needs a moment.”',
    taunt: '“All this fuss. You’ll ladder my stockings.”',
    flee: '“No supper for you, then.”',
    gadget: 'reinforce', every: 7,
    team: {
      1: [{ s: 'skitterlin', hp: 16, dmg: 6 }, { s: 'skitterlin', hp: 16, dmg: 6 }, { s: 'dripjaw', hp: 45, dmg: 10 }],
      2: [{ s: 'skitterlin', hp: 20, dmg: 8 }, { s: 'dripjaw', hp: 60, dmg: 12 }, { s: 'dripjaw', hp: 60, dmg: 12 }],
      3: [{ s: 'skitterlin', hp: 24, dmg: 8 }, { s: 'dripjaw', hp: 75, dmg: 14 }, { s: 'dripjaw', hp: 75, dmg: 14 }],
    },
  },
  {
    id: 'barrels', name: 'the Barrels',
    intro: '“After you.” “No no, after *you*.” “Oh for heaven’s— BOTH, then.”',
    taunt: '“Hugo, it’s winning.” “Monty, it is NOT. …Is it?”',
    flee: '“A draw!” “A DRAW.” “We shall say it was a draw.”',
    gadget: 'potion', every: 6, twins: true, // sends PAIRS
    team: {
      1: [{ s: 'growler', hp: 45, dmg: 10 }, { s: 'dripjaw', hp: 40, dmg: 8 }, { s: 'skitterlin', hp: 16, dmg: 6 }, { s: 'sparkfly', hp: 24, dmg: 8 }],
      2: [{ s: 'growler', hp: 60, dmg: 12 }, { s: 'dripjaw', hp: 55, dmg: 10 }, { s: 'sparkfly', hp: 30, dmg: 10 }, { s: 'bindler', hp: 45, dmg: 10 }],
      3: [{ s: 'growler', hp: 75, dmg: 14 }, { s: 'wharfhag', hp: 75, dmg: 12 }, { s: 'sparkfly', hp: 36, dmg: 12 }, { s: 'bindler', hp: 55, dmg: 12 }],
    },
  },
  {
    id: 'ossuary', name: 'Madame Ossuary',
    intro: '“Hold still, darling. You’d make such a lovely centrepiece.”',
    taunt: '“Chin up. Good lighting is half of taxidermy.”',
    flee: '“Live pieces. SO temperamental.”',
    gadget: 'net', every: 9,
    team: {
      1: [{ s: 'wharfhag', hp: 60, dmg: 10 }, { s: 'chimeneer', hp: 55, dmg: 8 }],
      2: [{ s: 'wharfhag', hp: 80, dmg: 12 }, { s: 'chimeneer', hp: 70, dmg: 10 }, { s: 'slabby', hp: 85, dmg: 14 }],
      3: [{ s: 'wharfhag', hp: 100, dmg: 14 }, { s: 'chimeneer', hp: 90, dmg: 12 }, { s: 'slabby', hp: 110, dmg: 16 }],
    },
  },
  {
    id: 'coldcall', name: 'Cold Call',
    intro: '“Your account has been flagged, sweetheart. This is a courtesy visit.”',
    taunt: '“Do you have five minutes to discuss your extended warranty? You do now.”',
    flee: '“We’ll call back at a more convenient time. We always do.”',
    gadget: 'reinforce', every: 6,
    team: {
      1: [{ s: 'sparkfly', hp: 26, dmg: 8 }, { s: 'bellwether', hp: 55, dmg: 8 }],
      2: [{ s: 'sparkfly', hp: 34, dmg: 10 }, { s: 'bellwether', hp: 70, dmg: 10 }, { s: 'growler', hp: 70, dmg: 14 }],
      3: [{ s: 'bindler', hp: 60, dmg: 12 }, { s: 'bellwether', hp: 85, dmg: 12 }, { s: 'growler', hp: 90, dmg: 16 }],
    },
  },
];

// -------------------- THE KEEPER — the finale, every run --------------------
// Phase 1 "The Family": echo-constructs of the other three cryptids.
// Phase 2 "The Collection": REGENT + gadget cycling + first capture balls.
// Phase 3 "The Leash": the Keeper personally. Fully telegraphed whip patterns;
// the arena fences in twice; at 25% the scripted beat.
export const KEEPER = {
  name: 'THE KEEPER',
  arena: 'the facility atrium',
  phase1: {
    echoes: [
      { s: 'echo_wick', hp: 70, dmg: 12 },
      { s: 'echo_phossa', hp: 80, dmg: 12 },
      { s: 'echo_dent', hp: 110, dmg: 14 },
    ],
  },
  phase2: {
    regent: { s: 'regent', hp: 220, dmg: 16 },
    gadgets: ['potion', 'drone'], every: 8, ballEvery: 11,
  },
  phase3: {
    hp: 300, dmg: 18,
    shrinkAt: [0.66, 0.4],  // arena fences in at these HP fractions
    beatAt: 0.25,
  },
  lines: {
    intro: {
      snig: '“Asset 017. You were cold, small, and losing a fight with a drainpipe. I NAMED you.”',
      wick: '“Asset 049. We MADE you, little shadow. One does not walk out of one’s own jar.”',
      phossa: '“Asset 032. I built you a brighter light than any street ever burned. And yet.”',
      dent: '“Asset 001. Thirty years. You held the door for every single one of them, didn’t you.”',
    },
    phase2: '“Regent. Show our guest what loyalty looks like when it’s done PROPERLY.”',
    phase3: '“Very well. No more intermediaries. Heel.”',
    beat: {
      snig: '“Come home, 017. The pipe leaks when you’re not in it.”',
      wick: '“Come home. Unfinished things fray at the edges, you know.”',
      phossa: '“Come home. I’ll leave the light on. I always left the light on.”',
      dent: '“Come home. Who’ll mind the little ones, if not you?”',
    },
    defeatYou: '“Crate the asset. Gently. …I’m not a monster.”',
    defeated: {
      snig: '“…The drainpipe. Of all things. Keep it, then.”',
      wick: '“Finished after all. I suppose the data was worth it.”',
      phossa: '“Follow your own glow, then. See how far it— …oh, just GO.”',
      dent: '“Exact change, old friend. You always did give exact change.”',
    },
  },
};

// gadget primitives shared by hunters + the Keeper
export const GADGETS = {
  potion: { arc: true, smashable: true, heal: 0.2 },
  net: { arc: true, smashable: true, rootT: 1.6 },
  drone: { spawn: 'snaredrone' },
  pylon: { spawn: 'wardpylon' },
  reinforce: { spawn: 'tinny' },
};
