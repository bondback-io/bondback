import type { AppErrorFlow } from "@/lib/errors/friendly-messages";
import { getFriendlyError } from "@/lib/errors/friendly-messages";
import { logClientError } from "@/lib/errors/log-client-error";
import type { ToastOptions } from "@/components/ui/use-toast";

export type ShowAppErrorToastOptions = {
  flow: AppErrorFlow;
  error: unknown;
  /** Log / analytics scope (defaults to `flow`) */
  context?: string;
  onRetry?: () => void;
};

type ToastFn = (options: ToastOptions) => void;

/**
 * Calm, user-facing error toast (muted styling). Logs full context to the console.
 */
export function showAppErrorToast(
  toast: ToastFn,
  options: ShowAppErrorToastOptions
): void {
  const { flow, error, context, onRetry } = options;
  logClientError(context ?? flow, error, { flow });
  const friendly = getFriendlyError(flow, error);
  const description = [friendly.description, friendly.nextAction]
    .filter(Boolean)
    .join(" ");
  toast({
    variant: "muted",
    title: friendly.title,
    description,
    ...(onRetry
      ? {
          actionButton: {
            label: "Retry",
            onClick: onRetry,
          },
        }
      : {}),
  });
}
