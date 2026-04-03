/**
 * postMessage types for Stripe-hosted flows opened in window.open() popups.
 * Parent listens on window; return pages post to opener with same origin check.
 */
export const STRIPE_POPUP_MESSAGE_CONNECT = "bondback-stripe-connect-complete" as const;
export const STRIPE_POPUP_MESSAGE_LISTER_SETUP = "bondback-stripe-lister-setup-complete" as const;

export type StripePopupConnectMessage = {
  type: typeof STRIPE_POPUP_MESSAGE_CONNECT;
  ok: boolean;
  error?: string;
};

export type StripePopupListerSetupMessage = {
  type: typeof STRIPE_POPUP_MESSAGE_LISTER_SETUP;
  ok: boolean;
  cancelled?: boolean;
  error?: string;
};

export function isStripePopupConnectMessage(
  data: unknown
): data is StripePopupConnectMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as StripePopupConnectMessage).type === STRIPE_POPUP_MESSAGE_CONNECT
  );
}

export function isStripePopupListerSetupMessage(
  data: unknown
): data is StripePopupListerSetupMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as StripePopupListerSetupMessage).type === STRIPE_POPUP_MESSAGE_LISTER_SETUP
  );
}

/** Open a centered popup for Stripe-hosted pages (Connect onboarding, Checkout, etc.). */
export function openStripePopup(url: string, windowName: string): Window | null {
  const w = Math.min(520, window.screen.width - 40);
  const h = Math.min(720, window.screen.height - 80);
  const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2);
  const features = [
    `width=${w}`,
    `height=${h}`,
    `left=${left}`,
    `top=${top}`,
    "scrollbars=yes",
    "resizable=yes",
    "noopener",
    "noreferrer",
  ].join(",");
  return window.open(url, windowName, features);
}
