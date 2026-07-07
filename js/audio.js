// Procedural audio: rainy lo-fi beats + a chunky sfx kit. No audio files.
// Lo-fi engine: 76 BPM swung hats, dusty minor keys (4-chord loop), sine sub
// bass, vinyl-noise + rain bed. Intensity crossfades layers (den < fight < boss).
let ctx = null;
let master, musicBus, sfxBus, noiseBuf;
let muted = false;
let musicTimer = null;
let intensity = 0.4;

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
  noiseBuf = makeNoise();
}
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; return m; }
export function isMuted() { return muted; }
export function setIntensity(v) { intensity = v; }

function makeNoise() {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function tone(freq, dur, { type = 'sine', vol = 0.3, bus = null, attack = 0.005, pitchEnd = null } = {}) {
  if (!ctx || muted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  if (pitchEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, pitchEnd), ctx.currentTime + dur);
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(bus || sfxBus);
  o.start(); o.stop(ctx.currentTime + dur + 0.02);
}

function noiseHit(dur, { vol = 0.3, hp = 800, lp = 8000, bus = null } = {}) {
  if (!ctx || muted) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const hpF = ctx.createBiquadFilter(); hpF.type = 'highpass'; hpF.frequency.value = hp;
  const lpF = ctx.createBiquadFilter(); lpF.type = 'lowpass'; lpF.frequency.value = lp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(hpF); hpF.connect(lpF); lpF.connect(g); g.connect(bus || sfxBus);
  src.start(); src.stop(ctx.currentTime + dur + 0.02);
}

// ---------- the lo-fi loop ----------
// Dusty i-VI-III-VII in C minor-ish, swung 8ths at 76 BPM.
const CHORDS = [
  [130.81, 155.56, 196.00],  // Cm
  [103.83, 130.81, 155.56],  // Ab
  [116.54, 146.83, 174.61],  // Bb-ish
  [98.00, 123.47, 146.83],   // G-ish
];
let beat = 0;

export function startMusic() {
  if (!ctx || musicTimer) return;
  // rain + vinyl bed (endless)
  const bed = ctx.createBufferSource();
  bed.buffer = noiseBuf; bed.loop = true;
  const bedF = ctx.createBiquadFilter(); bedF.type = 'bandpass'; bedF.frequency.value = 900; bedF.Q.value = 0.4;
  const bedG = ctx.createGain(); bedG.gain.value = 0.05;
  bed.connect(bedF); bedF.connect(bedG); bedG.connect(musicBus);
  bed.start();

  const spb = 60 / 76 / 2; // swung 8ths
  musicTimer = setInterval(() => {
    if (muted) { beat++; return; }
    const bar = Math.floor(beat / 8) % 4;
    const eighth = beat % 8;
    const swing = eighth % 2 === 1 ? 0.06 : 0;
    setTimeout(() => {
      // hats
      if (eighth % 2 === 0 || Math.random() < 0.6) noiseHit(0.03, { vol: 0.05 + intensity * 0.05, hp: 6000, bus: musicBus });
      // kick on 1 and the and-of-2
      if (eighth === 0 || eighth === 3) tone(52, 0.24, { vol: 0.32 + intensity * 0.22, bus: musicBus, pitchEnd: 30 });
      // snare-ish dusty tick on 3
      if (eighth === 4) noiseHit(0.09, { vol: 0.1 + intensity * 0.12, hp: 1400, lp: 4500, bus: musicBus });
      // keys: muted triangle chord stab, once per bar + a ghost
      if (eighth === 0 || (eighth === 5 && Math.random() < 0.5)) {
        for (const f of CHORDS[bar]) tone(f * 2, 0.9, { type: 'triangle', vol: 0.045, bus: musicBus, attack: 0.03 });
      }
      // sub walking the root
      if (eighth === 0 || eighth === 6) tone(CHORDS[bar][0] / 2, 0.5, { vol: 0.16 + intensity * 0.1, bus: musicBus });
    }, swing * 1000);
    beat++;
  }, spb * 1000);
}

// ---------- sfx kit ----------
export const sfx = {
  swing: (big) => { noiseHit(big ? 0.1 : 0.06, { vol: big ? 0.16 : 0.1, hp: 1800 }); },
  hit: (big) => {
    noiseHit(0.07, { vol: big ? 0.3 : 0.2, hp: 300, lp: 3200 });
    tone(big ? 90 : 140, 0.1, { vol: big ? 0.3 : 0.18, pitchEnd: 50 });
  },
  launch: () => { tone(160, 0.25, { vol: 0.28, pitchEnd: 480, type: 'square' }); noiseHit(0.12, { vol: 0.2, hp: 500 }); },
  slam: () => { tone(70, 0.3, { vol: 0.4, pitchEnd: 32 }); noiseHit(0.2, { vol: 0.3, hp: 120, lp: 1800 }); },
  jump: () => tone(220, 0.12, { vol: 0.08, pitchEnd: 380, type: 'triangle' }),
  dash: () => noiseHit(0.09, { vol: 0.12, hp: 2500 }),
  pdodge: () => { tone(660, 0.3, { vol: 0.2, type: 'triangle', pitchEnd: 990 }); tone(330, 0.4, { vol: 0.1 }); },
  tell: () => tone(196, 0.14, { vol: 0.12, type: 'square', pitchEnd: 150 }),
  hurt: () => { tone(110, 0.2, { vol: 0.3, type: 'sawtooth', pitchEnd: 60 }); noiseHit(0.12, { vol: 0.2, hp: 400 }); },
  blocked: () => tone(520, 0.08, { vol: 0.18, type: 'square' }),
  foeDown: () => { tone(240, 0.3, { vol: 0.2, pitchEnd: 90 }); noiseHit(0.16, { vol: 0.18, hp: 700 }); },
  ability: () => tone(440, 0.16, { vol: 0.14, type: 'triangle', pitchEnd: 587 }),
  interrupt: () => { tone(784, 0.12, { vol: 0.2, type: 'square' }); tone(392, 0.2, { vol: 0.12 }); },
  defeat: () => { tone(196, 0.8, { vol: 0.25, pitchEnd: 65, type: 'sawtooth' }); },
  ui: () => tone(520, 0.06, { vol: 0.1, type: 'triangle' }),
};
