/**
 * Short, soft in-app chime via Web Audio API (gentle sine partials, medium gain).
 * Browsers may block audio until a user gesture; we call AudioContext.resume() opportunistically.
 */

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!Ctor) return null;
    if (!sharedCtx) sharedCtx = new Ctor();
    return sharedCtx;
  } catch {
    return null;
  }
}

/** Default ~medium perceived loudness (master gain; sine partials are quiet). */
const DEFAULT_MASTER = 0.22;

/**
 * Plays a single calming “ding” — two soft harmonics with fast decay.
 */
export function playNotificationChime(options?: { masterVolume?: number }): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  void ctx.resume().catch(() => {});

  const masterVol = options?.masterVolume ?? DEFAULT_MASTER;
  const t0 = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = masterVol;
  master.connect(ctx.destination);

  // Soft chime: G5 + gentle upper partial, staggered for a bell-like decay
  const partials: { freq: number; delay: number; peak: number }[] = [
    { freq: 783.99, delay: 0, peak: 0.14 },
    { freq: 1174.66, delay: 0.028, peak: 0.07 },
  ];
  const decay = 0.22;

  for (const { freq, delay, peak } of partials) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0 + delay);
    const env = ctx.createGain();
    const start = t0 + delay;
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(peak, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0008, start + decay);
    osc.connect(env);
    env.connect(master);
    osc.start(start);
    osc.stop(start + decay + 0.04);
  }
}
