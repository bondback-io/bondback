import {
  getPublicSupportContactEmail,
  getSupportContactEmail,
} from "@/lib/support-contact-email";

function supportEmailForErrors(): string {
  if (typeof window === "undefined") {
    return getSupportContactEmail();
  }
  return getPublicSupportContactEmail();
}

export type AppErrorFlow =
  | "listing"
  | "photoUpload"
  | "bid"
  | "earlyAccept"
  | "payment"
  | "settings"
  | "generic";

export type FriendlyErrorParts = {
  title: string;
  description: string;
  /** Plain-English hint for what to do next */
  nextAction: string;
};

function scrubTechnical(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/supabase|postgres|rpc|jwt|uuid|column|relation|policy/i.test(t)) {
    return "";
  }
  if (t.length > 220) return t.slice(0, 217) + "…";
  return t;
}

/**
 * Maps a raw error to calm, non-alarming copy with a clear next step.
 */
export function getFriendlyError(
  flow: AppErrorFlow,
  error: unknown
): FriendlyErrorParts {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Something unexpected happened.";
  const lower = raw.toLowerCase();
  const detail = scrubTechnical(raw);

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      title: "You appear to be offline",
      description:
        "We couldn’t reach Bond Back. Check your Wi‑Fi or mobile data, then try again.",
      nextAction: "Reconnect and tap Retry, or try again in a moment.",
    };
  }

  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("load failed") ||
    error instanceof TypeError
  ) {
    return {
      title: "Connection hiccup",
      description:
        "The request didn’t finish. This is usually a brief network issue, not something wrong with your account.",
      nextAction: "Try again. If it keeps happening, switch networks or try again later.",
    };
  }

  switch (flow) {
    case "listing": {
      /** Do not scrub DB/RLS messages — users need the real PostgREST error to fix RLS or schema. */
      const listingMsg =
        raw.trim().length > 480 ? `${raw.trim().slice(0, 477)}…` : raw.trim();
      return {
        title: "We couldn’t finish your listing",
        description: listingMsg || "Saving your listing hit a snag before it went live.",
        nextAction:
          "Tap Retry to try again. Your answers stay on this page. If it continues, contact support.",
      };
    }
    case "photoUpload":
      return {
        title: "A photo didn’t upload",
        description: detail
          ? `What happened: ${detail}`
          : "One of your photos couldn’t be uploaded securely.",
        nextAction:
          "Check your connection, then try publishing again. Smaller photos or a different network often help.",
      };
    case "bid":
      return {
        title: "Your bid didn’t go through",
        description: detail
          ? `What happened: ${detail}`
          : "We couldn’t record your bid just now.",
        nextAction:
          "Tap Retry or refresh the page. If you’re a cleaner, confirm your bank account is connected under Settings.",
      };
    case "earlyAccept":
      return {
        title: "We couldn’t send the acceptance request",
        description: detail
          ? `What happened: ${detail}`
          : "The request to confirm this bid early didn’t send.",
        nextAction: "Try again in a moment. If it repeats, contact support with the job link.",
      };
    case "payment":
      return {
        title: "Payment step couldn’t complete",
        description: detail
          ? `What happened: ${detail}`
          : "Something interrupted the payment or payout step.",
        nextAction:
          "Try again shortly. For card or bank issues, check with your bank. You can also email support.",
      };
    case "settings":
      return {
        title: "Your changes weren’t saved",
        description: detail
          ? `What happened: ${detail}`
          : "We couldn’t update your settings.",
        nextAction: "Tap Retry or check your connection, then save again.",
      };
    default:
      return {
        title: "Something went wrong",
        description: detail
          ? `What happened: ${detail}`
          : "An unexpected issue occurred.",
        nextAction: `Try again, or email ${supportEmailForErrors()} if you need help.`,
      };
  }
}
