/**
 * In-app notification chime via Web Audio API — short major-triad “bell” (still polite, not alarm-like).
 * Browsers gate AudioContext behind user activation; resume() is async, so we retry
 * scheduling after resume. iOS/Safari often need a short silent buffer in the gesture path.
 */

const CHIME_DELAY_MS = 300;
const CHIME_COOLDOWN_MS = 2500;

/** Default output gain (0–1). Louder than the old soft ding, still discreet vs system alerts. */
export const DEFAULT_NOTIFICATION_CHIME_MASTER = 0.3;

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
 * Play a zeroed buffer in the same user-gesture turn — helps Safari/iOS fully unlock output.
 */
function playSilentUnlockBuffer(ctx: AudioContext): void {
  try {
    const rate = ctx.sampleRate || 44100;
    const frames = Math.max(128, Math.floor(rate * 0.01));
    const buf = ctx.createBuffer(1, frames, rate);
    const ch = buf.getChannelData(0);
    ch.fill(0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

/**
 * Create (if needed), resume, and prime output. Call from user gestures (click/tap/keydown).
 * Synchronous resume() + silent buffer in the same turn helps keep mobile Safari’s user activation.
 */
export function primeNotificationAudioFromUserGesture(): void {
  if (typeof window === "undefined") return;
  if (!sharedCtx) {
    sharedCtx = createAudioContext();
  }
  const ctx = sharedCtx;
  if (!ctx) return;

  void ctx.resume();
  try {
    playSilentUnlockBuffer(ctx);
  } catch {
    /* ignore */
  }

  void ctx.resume().then(() => {
    if (ctx.state === "running") {
      playSilentUnlockBuffer(ctx);
    }
  });
}

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
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
    devLog("skip play: not running", { state: ctx.state });
    void ctx.resume().catch(() => {});
    return;
  }

  devLog("playing chime");
  lastChimeAt = Date.now();

  try {
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = masterVol;
    master.connect(ctx.destination);

    /** Major triad (C5–E5–G5), staggered like a small bell — fuller than the old two high sines. */
    const partials: { freq: number; delay: number; peak: number }[] = [
      { freq: 523.25, delay: 0, peak: 0.24 },
      { freq: 659.25, delay: 0.02, peak: 0.16 },
      { freq: 783.99, delay: 0.04, peak: 0.095 },
    ];
    const decay = 0.4;
    const attack = 0.016;

    for (const { freq, delay, peak } of partials) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0 + delay);
      const env = ctx.createGain();
      const start = t0 + delay;
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(peak, start + attack);
      env.gain.exponentialRampToValueAtTime(0.0001, start + decay);
      osc.connect(env);
      env.connect(master);
      osc.start(start);
      osc.stop(start + decay + 0.06);
    }
  } catch (e) {
    console.warn("[notification-chime] play failed", e);
  }
}

function scheduleChimeAfterRunning(masterVol: number): void {
  const ctx = sharedCtx;
  if (!ctx) return;

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
 * Schedules the in-app chime. If context is not running yet (race after first tap), retries after resume().
 */
export function scheduleNotificationChime(options?: { masterVolume?: number }): void {
  const masterVol = options?.masterVolume ?? DEFAULT_NOTIFICATION_CHIME_MASTER;

  if (!sharedCtx) {
    devLog("schedule skipped: no AudioContext yet (user has not interacted)");
    return;
  }

  const ctx = sharedCtx;

  const attempt = () => {
    if (ctx.state === "running") {
      scheduleChimeAfterRunning(masterVol);
      return;
    }
    devLog("schedule: waiting for running", { state: ctx.state });
    void ctx.resume().then(() => {
      if (ctx.state === "running") {
        scheduleChimeAfterRunning(masterVol);
      } else {
        devLog("schedule: still not running after resume()", { state: ctx.state });
      }
    });
  };

  attempt();
}

/**
 * Play the chime right after a button click (e.g. Admin → Notifications QA).
 * Realtime-driven chimes often fail silently (no user gesture + cooldown); this runs from the
 * same interaction as the server action’s success path so audio can actually play.
 */
export function playNotificationChimeFromUserGesture(): void {
  primeNotificationAudioFromUserGesture();
  const ctx = sharedCtx;
  if (!ctx) return;
  const play = () => {
    if (ctx.state !== "running") return;
    lastChimeAt = Date.now();
    playChimeInternal(DEFAULT_NOTIFICATION_CHIME_MASTER);
  };
  if (ctx.state === "running") {
    play();
    return;
  }
  void ctx.resume().then(play);
}

/**
 * Manual test from Settings — must run from a real click/tap.
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
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }

  if (ctx.state === "running") {
    playSilentUnlockBuffer(ctx);
  }

  if (ctx.state !== "running") {
    devLog("test: context not running", { state: ctx.state });
    return;
  }

  playChimeInternal(DEFAULT_NOTIFICATION_CHIME_MASTER);
}

export function installNotificationAudioUnlockListeners(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const onGesture = () => {
    primeNotificationAudioFromUserGesture();
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible" && sharedCtx?.state === "suspended") {
      void sharedCtx.resume().catch(() => {});
    }
  };

  const opts = { capture: true, passive: true } as const;
  document.addEventListener("pointerdown", onGesture, opts);
  document.addEventListener("keydown", onGesture, opts);
  document.addEventListener("touchstart", onGesture, opts);
  document.addEventListener("click", onGesture, opts);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    document.removeEventListener("pointerdown", onGesture, opts);
    document.removeEventListener("keydown", onGesture, opts);
    document.removeEventListener("touchstart", onGesture, opts);
    document.removeEventListener("click", onGesture, opts);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
