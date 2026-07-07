# OFF-LEASH — build plan

## Context

Mathias wants a NEW game applying everything learned on Cute Fight: a **side-view brawler roguelike played from the monster's perspective**. You are an escaped "asset" fleeing THE KEEPER's collection facility through rainy neon city nights; hunter-trainers block each act with their monster teams and gadgets. Fights are the core — they must feel fun and flowy on touch. Locked through 11 Q&A rounds (do not relitigate):

- **OFF-LEASH**, private hobby project at `~/cc/offleash`, BordingCode, GitHub Pages, added to Bording Hub. English UI. Vanilla JS canvas PWA, no build step.
- **LANDSCAPE** phones/tablets; flat plane + jumping (Smash-lite juggles); moody neon-night tone; **British-anime dialogue** (dry wit, posh menace, composed drama); procedural **lo-fi beats** music.
- **Controls**: virtual stick (left) + A attack (A·A·A chain, ↑+A launcher, air A aerial, ↓+A dive slam) + jump + **dash-dodge w/ i-frames + perfect-dodge slow-mo** + 3 ability buttons. Input buffer ~0.1s, coyote time, react-on-touchdown. Buttons must never frustrate.
- **Run**: hideout + mission board; 3 acts; board offers ~5 missions, **clear 3 → act trainer**; mission types: arena bouts (+elites), cage rescues, sabotage (weakens act boss), escorts + auto-scroll chases. **~2h runs**, auto-save between missions (resume anytime; mid-mission close resumes at mission start), **death = run over, the run is the only cost**. PURE runs, no shortcuts. First win expected run **10+** — every system must reward losing well.
- **Evolution**: 4 essences — **STATIC** (speed/chains) · **RAIN** (flow/counters/sustain) · **RUST** (heavy/armor-break) · **MOON** (low-grav/air/juggles). Gathered during missions; **evolve once at Lv 6** into 1 of 4 essence forms (offer weighted by gathered essence, 2 shown, 3 w/ Trophy Shelf; silhouettes until first earned); **Lv 10 = Attunement** (signature move +1 tier, stat bump, tint-glow — no new art). 4 monsters × (base+4) = **20 forms**, each a fixed 3-move kit; mission rewards upgrade tiers of KNOWN moves.
- **Trainer bosses**: rotating pool of 7 hunters (3 drawn/run); trainer at arena edge sends monsters sequentially w/ overlap (next at ≤30% HP), lobs gadgets (potions smashable mid-air, nets, drones), final phase throws **capture-balls at YOU** (hit = wiggle-stick struggle escape). **Flat authored per-act stats — never level-multiplied** (known gotcha).
- **Final boss every run: THE KEEPER** — raised all four playable monsters; per-starter personal dialogue; win = out is out + Pursuit epilogues.
- **Meta**: freed monsters = new starters (each with its OWN mini-arc); den grows + story advances every run win/lose; achievements permanently enrich pools; capped 5-item power track; den = friends w/ evolving scenes + form gallery + practice yard. **HP bar + damage numbers**; healing scarce.
- **Opening**: scripted escape-night tutorial ~5min, skippable (cage → corridor A → kennel yard dodge → fence jump → chase → den → title card).
- **Pursuit ladder** (post-win, opt-in, ~8 levels): RULES not numbers.

## Design content (implement as data files)

### The 43 moves (Pokémon → brawler verbs; researched via Bulbapedia — priority brackets, status moves, Protect's consecutive-use penalty, Substitute's HP-trade, Sucker Punch's condition)

Invariant: **no move is a plain projectile** — every slot is a stance, timing window, channel, placed object, self-trade, buff, or enemy-AI manipulation. The A-chain grammar is the only bread-and-butter damage. Each move: cooldown button w/ ring, 3 tiers.

STATIC: **Blink Step** (Quick Attack: instant dash-strike, i-frames, resets chain) · **Mach Wire** (Extreme Speed: full-lane pierce dash) · **Overclock** (Agility: +40% speed 6s) · **Static Snare** (Thunder Wave: paralysis field) · **Cheap Shot** (Sucker Punch: only lands on mid-telegraph enemies — cancels their attack; heavy whiff lag) · **Flashbulb** (Fake Out: instant AoE flinch, once per enemy per engagement) · **Piston Jab** (Bullet Punch: frame-1 jab weavable mid-chain) · **Jam Signal** (Disable: cancel an enemy's windup, they can't use that move 10s @T2) · **Ghost Wire** (Volt Switch: strike + teleport behind) · **Live Wire** (Wild Charge: damaging dashes, 2% HP chip) · **Blown Fuse** (Explosion: huge nova, self-stun 1.5s).

RAIN: **Payback Stance** (Counter: 0.5s parry, return 2×) · **Mirror Veil** (Mirror Coat: hold to reflect projectiles) · **Umbrella Guard** (Protect: 0.8s block-everything bubble; CD doubles if reused within 5s) · **Storm Nap** (Rest: 2s vulnerable channel, heal 30%) · **Leech Burr** (Leech Seed: attach HP-drip sap) · **Siphon Fang** (Drain Punch: melee lifesteal 6s) · **Litter Decoy** (Substitute: pay 15% HP → taunting decoy + stealth) · **Broken Record** (Encore: lock enemy into repeating its last attack ×3) · **Glass Ward** (Light Screen: standing pane shatters projectiles) · **Drainpipe Vortex** (Whirlpool: pull + cluster enemies 1.5s) · **Stray's Grit** (Endure: 3s can't drop below 1 HP) · **Hoard & Hurl** (Stockpile: perfect-dodges bank stacks → burst) · **Cloudburst** (Rain Dance: 10s RAIN-CD reduction + HP trickle).

RUST: **Whetstone Ritual** (Swords Dance: next 5 hits +80%) · **Scrap Plating** (Iron Defense: 5s poise armor) · **Grudge Coil** (Bide: absorb 2s, release ×2 shockwave) · **Rustveil Fury** (Rage: hits taken stack +10% attack, max 5) · **Undergrate** (Dig: dive underground 1.2s, erupt as launcher) · **Mains Rupture** (Earthquake: hits all GROUNDED enemies ~400px, whiffs airborne) · **Held Breath** (Focus Punch: 1.5s charge, fizzles if hit, massive + armor-break) · **Caltrop Scatter** (Spikes: scrap hazard patch) · **Rust Screech** (Screech: cone armor-shred +30% dmg taken 6s) · **Junk Roll** (Rollout: steerable roll, +25% per consecutive hit) · **Cold Receipt** (Avalanche/Payback: 2× if you were hit since your last attack).

MOON: **Zero-G Drift** (Magnet Rise: half gravity 4s, +1 air jump, aerials +30%) · **Moonhop** (Bounce: huge i-frame leap, apex hover, dive-slam landing) · **Curfew Bell** (Trick Room: enemies 50% slower 4s) · **Lullaby Hum** (Yawn: delayed 2s sleep mark, 3s sleep, damage wakes) · **Last Aria** (Perish Song: mark all; melee-tagged enemies burst when the aria ends).

Achievement-gated: **Lucky Paw** (Metronome: random known move) · **Neon Afterimage** (Double Team: dashes leave decoys, MOON) · **Feral Pact** (Belly Drum: pay 50% HP, +100% dmg rest of mission, RUST).

### The four city-cryptids (each with own arc)

- **SNIG** — drainpipe dragon (oil-slick gutter serpent, brass tap-fitting horn). Balanced. Arc: *The Favourite* — the "I NAMED you" origin; was "home" ever real? Base kit: Umbrella Guard, Cheap Shot, Mains Rupture.
- **WICK** — living shadow peeled off a streetlamp in a power cut. Fast-precise, low HP, thin hurtbox. Arc: *The Experiment* — made in Lab 3, "unfinished"; it finishes itself. Kit: Blink Step, Payback Stance, Jam Signal.
- **PHOSSA** — lamplight moth, cat-sized, sodium-vapour wings. Aerial. Arc: *The Navigator* — lured in by floodlights; learns to steer by its own glow. Kit: Moonhop, Flashbulb, Lullaby Hum.
- **DENT** — vending-machine mimic, decommissioned, dispenses cans as armor. Heavy tank. Arc: *The Oldest Asset* — 30 years inside; escapes for the others. Kit: Scrap Plating, Cold Receipt, Grudge Coil.

### The 20 forms (base + 4 essence forms each; stat leans: STATIC +speed −HP · RAIN +counters/sustain · RUST +HP/poise −speed · MOON +air −grounded)

- SNIG → **FUSEWYRM** (Blink Step, Ghost Wire, Static Snare) / **SLUICE** (Umbrella Guard T2, Siphon Fang, Drainpipe Vortex) / **MAINSWYRM** (Mains Rupture T2, Whetstone Ritual, Undergrate) / **EAVEDRAKE** (Zero-G Drift, Moonhop, Cheap Shot T2)
- WICK → **STROBE** (Blink Step T2, Overclock, Flashbulb) / **MIRRORWICK** (Payback Stance T2, Mirror Veil, Litter Decoy) / **TARWICK** (Cold Receipt, Rustveil Fury, Jam Signal T2) / **NOCTURNE** (Neon Afterimage, Curfew Bell, Blink Step T2)
- PHOSSA → **ARCFLIT** (Piston Jab, Flashbulb T2, Live Wire) / **MISTWING** (Cloudburst, Leech Burr, Umbrella Guard) / **IRONMOTH** (Rust Screech, Scrap Plating, Moonhop T2) / **PALEWING** (Zero-G Drift T2, Lullaby Hum T2, Last Aria)
- DENT → **JOLTCRATE** (Blown Fuse, Static Snare T2, Piston Jab) / **SLUSHFUND** (Storm Nap, Grudge Coil T2, Glass Ward) / **SCRAPBANK** (Held Breath, Scrap Plating T2, Caltrop Scatter) / **GHOSTVEND** (Junk Roll T2, Moonhop, Curfew Bell)

### Bestiary — 10 enemies + 4 machines (EVERY lethal action telegraphs: color-flash 6Hz + audio pre-cue + posture frame + danger arc)

**Skitterlin** (rat swarm, chain fodder, STATIC) · **Growler** (stray-hound bruiser, long crouch+growl tell, cross-arena lunge — teaches dodge, RUST) · **Dripjaw** (gutter toad, inflate tell, arcing spit + puddle hazard, RAIN) · **Sparkfly** (neon insect, hover-shudder tell, dive-bomb — teaches aerials, MOON) · **Bindler** (living police tape, whip-coil tell, roots 1.5s mash-break, STATIC) · **Slabby** (concrete golem, POISE bar must break first, slow overhead slam, RUST) · **Wharfhag** (stilt heron, retaliates instantly after your 3rd chain hit — bait & counter, RAIN) · **Chimeneer** (chimney-smoke elemental, exhale tell → smog denial zone, RUST) · **Moonjelly** (drifting glow-jelly, living juggle target, MOON) · **Bellwether** (elite ram, bell-toll buffs all enemies until interrupted — kill-first, 2× essence). Elite affixes: Armored / Frenzied (tells ×0.8, floor 0.3s) / Leeching.

Machines: **Snare Drone** (laser-sight telegraph → net; netted = mash escape) · **Tinny** (cheap taser bot, combo food) · **Ward Pylon** (shields nearby enemies until smashed) · **Bloodhound Unit** (armored pursuit machine; drives chases + Curfew overtime).

### The 7 hunters (3 drawn per run; per-act FLAT stat rows in data)

1. **Beatrix Quill, "The Auditor"** — *"Dodge number forty-one. I do hope you're pacing yourself."* Team Bindler/Growler/Wharfhag; Ward Pylons mid-fight; multi-storey car park.
2. **Major Plumb** — *"My birds have brought down finer things than you."* Sparkflies + Moonjelly; patrol Snare Drones; windy rooftop (drift force).
3. **The Vicar** — *"Terribly sorry about all this. Do try not to bleed on the flagstones."* Slabby/Bellwether/Growler; incense heal-drone; derelict chapel.
4. **Nanny Grit** — *"Sit still, pet. Nanny only needs a moment."* Skitterlin swarms + Dripjaws; knitting-needle turret (huge smashable projectiles); laundrette alley.
5. **The Barrels** (posh twins, one coat) — *"After you." "No no, after* you.*"* Sends TWO weaker monsters at once; potion crossfire from both edges; canal bridge.
6. **Madame Ossuary** — *"Hold still, darling. You'd make such a lovely centrepiece."* Elite-affixed team; pose-trap freeze zones; museum hall.
7. **Cold Call** — *"Your account has been flagged, sweetheart. This is a courtesy visit."* Tinny swarm + Bellwether; alarm beacon summons reinforcements until smashed; neon high street.

### THE KEEPER — 3 phases, facility atrium (rain on glass), per-starter dialogue (4 scripts)

P1 **The Family**: echo-constructs of the other three playable cryptids, simplified kits. P2 **The Collection**: the Keeper's own cryptid **REGENT** (lamppost-iron & stained-glass peacock: Rust Screech, Moonhop, feather-fan melee) + gadget cycling + first capture-balls. P3 **The Leash**: the Keeper personally, energy whip (sweep/crack/grab-pull, fully telegraphed), arena shrinks twice; at 25% HP a scripted beat — the whip lowers: *"You were cold, small, and losing a fight with a drainpipe. Come home."* — 3s where attacking is the answer. Win = out; per-starter epilogues; den becomes post-game hub.

### Missions, Pursuit, power track, achievements

- **Templates**: Bout (waves, elite variant), Rescue (defend 2 timed locks; frees friends/starters in fixed story order), Sabotage (2-3 guarded objectives; all destroyed = act trainer loses one gadget), Escort (2 scripted ambushes), Chase (auto-scroll vs Bloodhound; caught = low-arena fight). Board: seeded; ≥1 rescue while starters locked; ≥1 sabotage/act; essence biases displayed. 6-8 min/mission.
- **Pursuit 1-8**: Spotters (extra machine/arena) · Lockdown (a board slot padlocked) · Curfew (overtime → Bloodhound hunts) · Rationing (no den heal between acts) · Marked (final-phase gadgets from send one) · The Understudy (Keeper ambush between acts 2-3, Leash-only to 50%: "Just checking your form, darling.") · Elites Everywhere · Off the Grid (blind board + Keeper P3 second pattern set).
- **Power track** (den tokens, capped): Soft Bedding +1 heart-equivalent maxHP · Noticeboard Contacts (6 offers) · Sparring Scarecrow (start Lv2) · Rain Barrel (1 heal charge/act) · Trophy Shelf (3 evolution directions).
- **Achievements (10)**: Gutter Reflexes (10 perfect dodges/mission → Hoard & Hurl) · Bar Brawler (15 potions smashed → potions drop heals) · Untouchable (→ Neon Afterimage) · Wrecking Crew (5 sabotages → Blown Fuse) · Old Grudges (500 stance dmg → Feral Pact) · Exact Change (free DENT → Lucky Paw) · Read the Room (25 interrupts → T3 upgrades from act 2) · Repeat Offender (die to same trainer 2× → their tells gain audio pre-cues) · Long Way Round (reach act 3 ×5 → +essence variety) · Named (first Keeper loss → Keeper constructs join practice yard).

## Tech plan

### Architecture (`~/cc/offleash/`) — mirror cutefight's proven shape

```
index.html (canvas+HUD, PORTRAIT rotate prompt, boot watchdog, hub-stats app:"offleash")
manifest.json (landscape) · sw.js (CACHE offleash-v1, network-first; full SHELL list)
css/main.css · assets/icons/ (tools/build_icons.py pattern)
js/main.js        — glue: screen router, HUD, events→FX/sfx/save switch
js/audio.js       — procedural lo-fi (72-84 BPM swung hats, sub bass, vinyl+rain noise beds,
                    muted keys; intensity den<mission<boss) + sfx kit
js/engine/        — LIFT from ~/cc/cutefight/js/engine/: loop.js, pool.js, vec.js (+rectHit),
                    fx.js (+rain emitter), pixels.js (+tintOverlay), canvas.js → WORLD 960×540
js/data/          — palette.js, sprites.js, moves.js (43×3 tiers), forms.js (20),
                    bestiary.js (10+4), trainers.js (7+Keeper, flat act1/2/3 stat rows),
                    missions.js, story.js (4 arcs), pursuit.js, achievements.js
js/game/          — world.js (PURE sim), input.js (stick+6 buttons+keyboard), render.js,
                    director.js (waves + trainer/Keeper phase scripts), run.js (seeded board,
                    acts, essence, evolution offers), den.js, save.js
tools/sprites.html · tools/sim.test.mjs · docs/PLAN.md (this file)
```

### Key sim decisions

- **Side-view collapse of cutefight physics**: y = height; `GROUND_Y=460`, `GRAV=2200`, jump vy −780, double −680 (MOON ×0.7 gravity +1 jump), dive +1400. Juggle decay: knockback × `1/(1+0.25·juggle)` — infinites self-terminate. Optional platforms `[{x,w,y}]`. Camera follows on wider arenas (960-1600).
- **Attacks = data**: `{startup, active, recovery, hitbox rect, dmg, kb, hitstop, cancel}` — rect-vs-rect (add rectHit to vec.js), `struck` set per activation. Every one of the 43 moves must fit the shared schema + ≤~10 lines special-case sim code, else redesign.
- **Feel**: input ring-buffer 0.1s, coyote 0.08s, land-consumes-buffer; dash 0.28s i-frames 1-12; perfect dodge = enemy active window ∩ your i-frames → 0.35s slow-mo via loop.speed (sim-deterministic), gauge/stack bonus. hitStop/trauma/floatText from cutefight fx.js.
- **Determinism**: no Math.random in world — seeded mulberry32 (KB recipes/seeded-rng.js); events[] contract identical to cutefight; `window.__ol` debug (spawn/kill/skipToAct/grantEssence).
- **Save `offleash_save_v1`**: `{meta:{starters, denFriends, gallery, achievements, powerTrack, denTokens, pursuitBest, wins, runs, storySeen}, run: null|{seed, pursuit, starter, formId, level, xp, essence, hp, moves[{id,tier}], act, board, cleared, atMission}, settings}`. Mid-mission quit resumes at mission START (pre-mission snapshot). Death clears run, keeps meta.
- **Headless tests** `tools/sim.test.mjs`: chain kills Skitterlin; dodge negates Growler lunge; perfect-dodge detected; launcher→aerial→dive connects; juggle terminates; Slabby poise; trainer overlap at 30%; struggle escape; Keeper phases; save round-trip; same seed+inputs ⇒ identical state hash.

### Art budget (the biggest risk — mitigated)

20 forms × 9 frames naïvely = 180 grids at 32×32. Plan: author 4 base cryptids fully (36 grids); essence forms = base grids + palette remap + 1-2 authored signature-overlay rows (horn/wings/plating) composited at bake → ~70 authored grids total; hurt = tint() free; jump = air-frame offset; attunement = pure glow tint. Bestiary 5 frames each, machines 3. Spread art across all milestones (agents), keep tools/sprites.html hot.

## Milestones (each keyboard-testable; J/Space=A, K=jump, L=dash, U/I/O=abilities, WASD move)

1. **M1 Core fight feel (~25%, FIRST)**: repo+shell+engine lift, landscape canvas + rotate prompt, input cluster, full A-grammar + jump/double/dive + dash/perfect-dodge + buffer/coyote, SNIG base kit, Growler+Skitterlin, full juice, practice arena. Exit: juggle a Growler; slow-mo perfect dodge; sim tests green. **Feel sign-off on Mathias's phone before proceeding.**
2. **M2 Run loop (~15%)**: seeded boards, 3 acts, Bout+Sabotage, HP/heal economy, save/resume, death screen (cause of death + reflection + one-tap Again).
3. **M3 Evolution (~15%)**: essence gathering/biases, Lv6 offer (silhouettes) + Lv10 attunement, ALL 43 moves, 20 kits live (tinted placeholders OK), tier upgrades.
4. **M4 Trainers (~20%)**: director phase scripts, full bestiary+machines, 7 hunters+gadgets+arenas, capture-ball struggle, Keeper 3 phases, Rescue/Escort/Chase, sabotage→gadget removal.
5. **M5 Den+meta+story (~12%)**: den screens, starter unlock chain, achievements, 4 arcs + loss-advances-story cadence, epilogues.
6. **M6 Tutorial+Pursuit+polish (~10%)**: escape-night opening, Pursuit 1-8, final art pass, music polish, reduce-motion, balance via headless "competent input tape" regression.
7. **M7 Verify+deploy (~3%)**: Playwright E2E (boot/tutorial/mission/save-resume/rotate), sw SHELL + bump, icons, real-phone iOS landscape check (safe-area-inset LEFT/RIGHT), push + deploy-verify (watch the known Pages-failure flakiness), Bording Hub entry, memory update.

## Risks

Art volume (mitigated above, still the long pole) · 2h-run pacing (mid-run resume must be bulletproof; if act 2 sags → board 4-clear-3 before touching numbers) · landscape PWA quirks (no orientation lock in browser; portrait #rotate overlay; iOS toolbars + safe-area sides; audio unlock on first gesture; test on real phone in M1) · 10+-run wall without rubber-banding (tune tells/cadence/composition — rules before numbers; no hidden catch-up EVER) · 6 touch targets = practical ceiling (≥56px, cooldown rings, leftHand mirror; validate in M1, fallback 2 abilities + swipe) · 43-move sprawl (schema discipline).

## Verification

Headless: `node tools/sim.test.mjs` invariants + seeded determinism hash. Browser (Playwright): fresh boot → tutorial → starter run → mission clear → quit/resume mid-run → death screen → den growth → evolution offer → trainer fight incl. struggle → console clean; portrait shows rotate prompt; real-device touch check each milestone. Deploy: bump CACHE+?v=, push, `gh run list` (Pages deploys fail transiently — retrigger with empty commit), deploy-verifier confirms live, then hub + memory.
