/**
 * Sound effects using the Web Audio API.
 * All sounds are generated entirely in code — no audio files needed.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx || ctx.state === "closed") {
    ctx = new AudioContext();
  }
  return ctx;
}

function gain(ac: AudioContext, value: number, at?: number): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(value, at ?? ac.currentTime);
  return g;
}

function sine(ac: AudioContext, freq: number, start: number, duration: number, volume = 0.18): void {
  const osc = ac.createOscillator();
  const g = gain(ac, 0, start);
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  // Tiny attack + fast decay
  g.gain.linearRampToValueAtTime(volume, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.01);
}

function triangle(ac: AudioContext, freq: number, start: number, duration: number, volume = 0.12): void {
  const osc = ac.createOscillator();
  const g = gain(ac, 0, start);
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, start);
  g.gain.linearRampToValueAtTime(volume, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.01);
}

function sawtooth(ac: AudioContext, freq: number, start: number, duration: number, volume = 0.06): void {
  const osc = ac.createOscillator();
  const g = gain(ac, 0, start);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, start);
  g.gain.linearRampToValueAtTime(volume, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.01);
}

// ── Public sounds ─────────────────────────────────────────────────────────────

/** Soft "whoosh" pop — message sent */
export function playSend(): void {
  try {
    const ac = getCtx();
    const now = ac.currentTime;
    // Quick upward frequency sweep — feels like a paper airplane launching
    const osc = ac.createOscillator();
    const g = gain(ac, 0, now);
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.12);
    g.gain.linearRampToValueAtTime(0.14, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(g).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.23);

    // Subtle body — makes it feel solid
    triangle(ac, 480, now, 0.14, 0.07);
  } catch {}
}

/** Gentle two-note chime — message received */
export function playReceive(): void {
  try {
    const ac = getCtx();
    const now = ac.currentTime;
    // Perfect fifth: C5 (523 Hz) → G5 (784 Hz), soft and pleasing
    sine(ac, 523, now, 0.35, 0.13);
    sine(ac, 784, now + 0.13, 0.38, 0.11);
    // Soft sub-harmonic body
    triangle(ac, 262, now, 0.28, 0.05);
  } catch {}
}

/** Ascending arpeggio — invoice created 🎉 */
export function playSuccess(): void {
  try {
    const ac = getCtx();
    const now = ac.currentTime;
    // C5 – E5 – G5 – C6 mini arpeggio
    const notes = [523, 659, 784, 1047];
    const step = 0.1;
    notes.forEach((freq, i) => {
      sine(ac, freq, now + i * step, 0.45 - i * 0.04, 0.16 - i * 0.015);
      // Add a triangle harmonic for richness
      triangle(ac, freq * 2, now + i * step, 0.2, 0.04);
    });
    // Final shimmer
    sine(ac, 1397, now + notes.length * step + 0.05, 0.5, 0.06);
  } catch {}
}

/** Soft "hmm" buzz — error / unavailable */
export function playError(): void {
  try {
    const ac = getCtx();
    const now = ac.currentTime;
    // Descending two-note — E3 → B2, muted and honest
    sine(ac, 330, now, 0.22, 0.12);
    sine(ac, 247, now + 0.18, 0.32, 0.10);
    // Slight "buzzy" texture to signal problem
    sawtooth(ac, 165, now + 0.02, 0.18, 0.04);
  } catch {}
}

/** Gentle "ding-dong" — missing fields, needs attention */
export function playMissingFields(): void {
  try {
    const ac = getCtx();
    const now = ac.currentTime;
    // A4 → D5 — calm but attentive
    sine(ac, 440, now, 0.30, 0.12);
    sine(ac, 587, now + 0.18, 0.35, 0.10);
    triangle(ac, 220, now, 0.25, 0.04);
  } catch {}
}

/** Soft "pop-confirm" — form submitted / action triggered */
export function playConfirm(): void {
  try {
    const ac = getCtx();
    const now = ac.currentTime;
    // Two quick high-pitched pops — snappy and satisfying
    sine(ac, 880, now, 0.12, 0.11);
    sine(ac, 1100, now + 0.08, 0.14, 0.09);
    triangle(ac, 440, now, 0.1, 0.04);
  } catch {}
}

/** Soft single ping — quick action result arrived */
export function playPing(): void {
  try {
    const ac = getCtx();
    const now = ac.currentTime;
    // Single pure tone — G5 — clean and minimal
    sine(ac, 784, now, 0.28, 0.11);
    triangle(ac, 392, now + 0.01, 0.2, 0.04);
  } catch {}
}

/** Unlock AudioContext on first user gesture (required by browsers) */
export function unlockAudio(): void {
  try { getCtx(); } catch {}
}
