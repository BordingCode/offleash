// The den's story — scenes unlock by what your runs have LIVED, win or lose.
// Voice: British-anime. Short, skippable, written with restraint.
// when: conditions vs meta {runs, wins, starters, denFriends, deaths, act3Reached}
export const SCENES = [
  {
    id: 'first_night', when: { runs: 0 },
    speaker: 'SNIG', lines: [
      'The den. Cold pipe, dry corner, no bars.',
      'It isn’t much. It’s yours. That word tastes new.',
      'Somewhere behind you, the facility hums. Somewhere ahead — out.',
    ],
  },
  {
    id: 'first_loss', when: { runs: 1, wins: 0 },
    speaker: 'SNIG', lines: [
      'Caught. Netted. Dragged back within sight of the door.',
      '…And yet: here you are again. The den held. The door still isn’t locked.',
      'They can catch you a hundred times. You only have to leave once.',
    ],
  },
  {
    id: 'wick_free', when: { starters: 2 },
    speaker: 'WICK', lines: [
      '“You opened the cage. Why.”',
      '“…No. Don’t explain. Explanations are how they start.”',
      '“I’m WICK. I was a lab experiment. Now I’m a lodger. The rent is: I watch the door.”',
    ],
  },
  {
    id: 'wick_settles', when: { starters: 2, runs: 4 },
    speaker: 'WICK', lines: [
      '“You died horribly out there. I could tell because you came home diagonal.”',
      '“The Keeper used to say I was unfinished. I have decided to finish myself.”',
      '“Take me next time. I’m faster than you. It isn’t close.”',
    ],
  },
  {
    id: 'phossa_free', when: { starters: 3 },
    speaker: 'PHOSSA', lines: [
      '“Lights. So many lights out there, and I followed the wrong one for years.”',
      '“The facility floodlights sing, you know. A frequency like a promise.”',
      '“I’m PHOSSA. I don’t follow lights anymore. I make my own. Watch.”',
    ],
  },
  {
    id: 'dent_free', when: { starters: 4 },
    speaker: 'DENT', lines: [
      '“Thirty years. You get to know a place. Every corridor. Every camera blind spot.”',
      '“I held the door for two hundred and eleven of us, over the years. Never walked through it myself.”',
      '“DENT. Yes, like the side panel. The Keeper named me too, once. We don’t use that one.”',
    ],
  },
  {
    id: 'act3_reached', when: { act3Reached: 1 },
    speaker: 'WICK', lines: [
      '“You reached the facility ring. You saw the atrium glass.”',
      '“…The Keeper knows your gait by now. Vary it.”',
    ],
  },
  {
    id: 'first_win', when: { wins: 1 },
    speaker: 'SNIG', lines: [
      'You made it OUT. Rain with no roof edge over it. Whole horizon, no fence.',
      'And then you turned around.',
      'Because the den is still full of ears that flinch at footsteps. That’s why the runs continue. That was always why.',
    ],
  },
  {
    id: 'many_runs', when: { runs: 8 },
    speaker: 'DENT', lines: [
      '“Eight escapes. The Vicar has started a card for you. Nanny Grit knits during the quiet bits.”',
      '“You’ve become their whole social calendar. Do try to be flattered.”',
    ],
  },
  {
    id: 'the_hard_wall', when: { runs: 12, wins: 0 },
    speaker: 'PHOSSA', lines: [
      '“Twelve nights out. Twelve walks home.”',
      '“A moth navigates by a fixed light. You keep changing yours — new forms, new moves. That’s not failure. That’s bearings.”',
      '“The thirteenth light might be the door.”',
    ],
  },
];

// small talk when nothing new is unlocked — one per den visit, rotating
export const DEN_IDLE = [
  ['WICK', '“The rain has opinions tonight.”'],
  ['PHOSSA', '“I dusted the lamp. It’s not a nest. Don’t call it a nest.”'],
  ['DENT', '“I dispense advice now. And occasionally crisps. The mechanism lingers.”'],
  ['SNIG', 'The pipe drips in threes. Home noises.'],
  ['WICK', '“Nothing followed you. I checked twice. …Three times.”'],
  ['DENT', '“Sleep. Even escape artists rust.”'],
];

// starters unlock in this order via rescue missions (one per act tier)
export const RESCUE_ORDER = ['wick', 'phossa', 'dent'];
export const CRYPTID_NAMES = { snig: 'SNIG', wick: 'WICK', phossa: 'PHOSSA', dent: 'DENT' };
