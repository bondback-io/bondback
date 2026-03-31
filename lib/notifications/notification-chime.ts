/**
 * Soft in-app “ding” via Web Audio API.
 * Browsers require AudioContext.resume() from a user gesture before audio can play;
 * we only create the context from unlock paths, then play only when state is "running".
 */

const CHIME_DELAY_MS = 300;
/** Ignore further triggers shortly after a chime (burst of INSERTs). */
const CHIME_COOLDOWN_MS = 2500;

const DEFAULT_MASTER = 0.18;

let sharedCtx: AudioContext | null = null;

function createAudioContext(): AudioContext | null {
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
    return new Ctor();
  } catch {
    return null;
  }
}

/**
 * Create (if needed) and resume the shared context. Call from user gestures only
 * (click, tap, keydown) so autoplay policy allows playback.
 */
export function primeNotificationAudioFromUserGesture(): void {
  if (typeof window === "undefined") return;
  if (!sharedCtx) {
    sharedCtx = createAudioContext();
  }
  const ctx = sharedCtx;
  if (!ctx) return;
  void ctx.resume().catch(() => {});
}

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
/** Timestamp of last successful chime start (cooldown vs. burst INSERTs). */
let lastChimeAt = 0;

function devLog(message: string, extra?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  if (extra) {
    console.debug(`[notification-chime] ${message}`, extra);
  } else {
    console.debug(`[notification-chime] ${message}`);
  }
}

function playChimeInternal(masterVol: number): void {
  const ctx = sharedCtx;
  if (!ctx) {
    devLog("skip play: no AudioContext (unlock first)");
    return;
  }
  if (ctx.state !== "running") {
    devLog("skip play: AudioContext not running", { state: ctx.state });
    void ctx.resume().catch(() => {});
    return;
  }

  devLog("playing chime");
  lastChimeAt = Date.now();

  const t0 = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = masterVol;
  master.connect(ctx.destination);

  const partials: { freq: number; delay: number; peak: number }[] = [
    { freq: 880, delay: 0, peak: 0.11 },
    { freq: 1320, delay: 0.025, peak: 0.055 },
  ];
  const decay = 0.28;

  for (const { freq, delay, peak } of partials) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0 + delay);
    const env = ctx.createGain();
    const start = t0 + delay;
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(peak, start + 0.014);
    env.gain.exponentialRampToValueAtTime(0.0006, start + decay);
    osc.connect(env);
    env.connect(master);
    osc.start(start);
    osc.stop(start + decay + 0.05);
  }
}

/**
 * Schedules the in-app chime (delay + cooldown + single pending timer).
 * Use for realtime notifications. Requires prior user gesture via unlock listeners or bell/settings.
 */
export function scheduleNotificationChime(options?: { masterVolume?: number }): void {
  const masterVol = options?.masterVolume ?? DEFAULT_MASTER;
  const ctx = sharedCtx;
  if (!ctx || ctx.state !== "running") {
    devLog("schedule skipped: context missing or not running", {
      hasContext: !!ctx,
      state: ctx?.state,
    });
    return;
  }

  const now = Date.now();
  if (lastChimeAt > 0 && now - lastChimeAt < CHIME_COOLDOWN_MS) {
    devLog("schedule skipped: cooldown");
    return;
  }

  if (pendingTimer) {
    devLog("schedule skipped: already queued");
    return;
  }

  devLog("scheduled", { delayMs: CHIME_DELAY_MS });

  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    playChimeInternal(masterVol);
  }, CHIME_DELAY_MS);
}

/**
 * Manual test from Settings: must run from a click/tap so resume() is allowed.
 */
export async function testNotificationChime(): Promise<void> {
  primeNotificationAudioFromUserGesture();
  const ctx = sharedCtx;
  if (!ctx) {
    devLog("test: no AudioContext");
    return;
  }
  try {
    await ctx.resume();
  } catch {
    return;
  }
  if (ctx.state !== "running") {
    devLog("test: context not running after resume", { state: ctx.state });
    return;
  }
  playChimeInternal(DEFAULT_MASTER);
}

/**
 * Attach one-time unlock on first pointer or key interaction + visibility resume.
 */
export function installNotificationAudioUnlockListeners(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const onFirstGesture = () => {
    primeNotificationAudioFromUserGesture();
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible" && sharedCtx?.state === "suspended") {
      void sharedCtx.resume().catch(() => {});
    }
  };

  const opts = { capture: true, passive: true } as const;
  document.addEventListener("pointerdown", onFirstGesture, opts);
  document.addEventListener("keydown", onFirstGesture, opts);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    document.removeEventListener("pointerdown", onFirstGesture, opts);
    document.removeEventListener("keydown", onFirstGesture, opts);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
