/**
 * Synthetic MBTA station chime via the Web Audio API (no audio files).
 * Two triangle-wave tones: F#5 then D5 with exponential decay envelopes.
 */

let sharedCtx: AudioContext | null = null;
let unlockPromise: Promise<void> | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

function triangleTone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  decaySeconds: number,
  gainValue: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + decaySeconds);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + decaySeconds + 0.05);
}

/** Play a near-silent buffer to satisfy browser autoplay policies on kiosks. */
async function primeAudioContext(ctx: AudioContext): Promise<void> {
  const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
  source.stop(ctx.currentTime + 0.01);
}

/** Play the iconic two-tone MBTA chime. Resolves when both notes have finished. */
export function playMBTAChime(): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    if (!ctx) {
      resolve();
      return;
    }

    const play = () => {
      const t0 = ctx.currentTime + 0.02;
      triangleTone(ctx, 739.99, t0, 0.6, 0.28); // F#5
      triangleTone(ctx, 587.33, t0 + 0.4, 0.8, 0.24); // D5
      window.setTimeout(() => resolve(), 1300);
    };

    if (ctx.state === "suspended") {
      void ctx.resume().then(play).catch(() => resolve());
    } else {
      play();
    }
  });
}

/** @deprecated Use playMBTAChime */
export const playMbtaChime = playMBTAChime;

export async function unlockAudio(): Promise<void> {
  if (unlockPromise) {
    await unlockPromise;
    return;
  }

  unlockPromise = (async () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      await primeAudioContext(ctx);
    } catch {
      /* ignore */
    }
  })();

  await unlockPromise;
}
