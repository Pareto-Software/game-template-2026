// Sound effects made with the Web Audio API – no sound files needed (shared kit file – used by every game).
//
// sfx('jump')                 – play a sound
// sfx('coin', { pitch: 1.5 }) – higher (2 = an octave up, 0.5 = an octave down)
// sfx('boom', { volume: 2 })  – louder
// M mutes and unmutes all sounds.
//
// Sound names: jump, coin, hit, powerup, win, lose, boom, click, shoot, bounce, roar, fart

export type SoundName =
  | 'jump' | 'coin' | 'hit' | 'powerup' | 'win' | 'lose'
  | 'boom' | 'click' | 'shoot' | 'bounce' | 'roar' | 'fart';

export const SOUND_NAMES: SoundName[] = [
  'jump', 'coin', 'hit', 'powerup', 'win', 'lose', 'boom', 'click', 'shoot', 'bounce', 'roar', 'fart',
];

const MASTER_VOLUME = 0.18; // many laptops share one room – keep it low

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function audio(): AudioContext | null {
  if (!ac) {
    try {
      ac = new AudioContext();
      master = ac.createGain();
      master.gain.value = MASTER_VOLUME;
      master.connect(ac.destination);
    } catch {
      return null;
    }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

// Browsers only allow sound after the first key press or click.
const unlock = () => audio();
addEventListener('keydown', unlock, { once: true });
addEventListener('pointerdown', unlock, { once: true });
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat) muted = !muted;
});

function tone(
  type: OscillatorType, from: number, to: number, start: number, dur: number, vol: number,
) {
  const a = ac!;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, start);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  o.connect(g).connect(master!);
  o.start(start);
  o.stop(start + dur + 0.02);
  return o;
}

function noise(start: number, dur: number, vol: number, lowpass = 3000) {
  const a = ac!;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(start);
}

export function sfx(name: SoundName, o: { pitch?: number; volume?: number } = {}) {
  if (muted) return;
  const a = audio();
  if (!a || !master) return;
  // A little random pitch so repeated sounds don't get boring.
  const p = (o.pitch ?? 1) * (0.95 + Math.random() * 0.1);
  const v = o.volume ?? 1;
  const t = a.currentTime;
  switch (name) {
    case 'jump': tone('square', 300 * p, 700 * p, t, 0.15, 0.3 * v); break;
    case 'coin':
      tone('sine', 990 * p, 990 * p, t, 0.08, 0.5 * v);
      tone('sine', 1320 * p, 1320 * p, t + 0.07, 0.2, 0.5 * v);
      break;
    case 'hit': tone('sawtooth', 220 * p, 60 * p, t, 0.25, 0.4 * v); noise(t, 0.15, 0.4 * v); break;
    case 'powerup':
      [523, 659, 784, 1047].forEach((f, i) => tone('square', f * p, f * p * 1.02, t + i * 0.07, 0.12, 0.25 * v));
      break;
    case 'win':
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone('triangle', f * p, f * p, t + i * 0.12, 0.2, 0.5 * v));
      break;
    case 'lose':
      [392, 330, 262, 196].forEach((f, i) => tone('triangle', f * p, f * p * 0.97, t + i * 0.15, 0.22, 0.5 * v));
      break;
    case 'boom': noise(t, 0.6, 0.9 * v, 900); tone('sine', 120 * p, 30 * p, t, 0.5, 0.6 * v); break;
    case 'click': tone('square', 800 * p, 600 * p, t, 0.04, 0.2 * v); break;
    case 'shoot': tone('square', 900 * p, 200 * p, t, 0.12, 0.25 * v); break;
    case 'bounce': tone('sine', 200 * p, 900 * p, t, 0.18, 0.5 * v); break;
    case 'roar': {
      const o1 = tone('sawtooth', 110 * p, 70 * p, t, 0.7, 0.5 * v);
      const lfo = a.createOscillator();
      const lg = a.createGain();
      lfo.frequency.value = 18;
      lg.gain.value = 25;
      lfo.connect(lg).connect(o1.frequency);
      lfo.start(t);
      lfo.stop(t + 0.75);
      noise(t, 0.6, 0.3 * v, 600);
      break;
    }
    case 'fart': {
      const o1 = tone('sawtooth', 90 * p, 55 * p, t, 0.45, 0.6 * v);
      const lfo = a.createOscillator();
      const lg = a.createGain();
      lfo.frequency.value = 30;
      lg.gain.value = 30;
      lfo.connect(lg).connect(o1.frequency);
      lfo.start(t);
      lfo.stop(t + 0.5);
      noise(t, 0.35, 0.25 * v, 400);
      break;
    }
  }
}
