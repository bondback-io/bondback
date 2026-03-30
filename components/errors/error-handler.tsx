"use client";

import * as React from "react";
import { useToast } from "@/components/ui/use-toast";
import { showAppErrorToast, type ShowAppErrorToastOptions } from "@/components/errors/show-app-error-toast";
import { getFriendlyError, type AppErrorFlow } from "@/lib/errors/friendly-messages";
import { logClientError } from "@/lib/errors/log-client-error";
import { AppErrorModal } from "@/components/errors/app-error-modal";

type CriticalPayload = {
  flow: AppErrorFlow;
  error: unknown;
  context?: string;
  onRetry?: () => void;
  onBack?: () => void;
};

type ErrorHandlerContextValue = {
  /** Muted toast with friendly copy + optional Retry */
  toastError: (options: ShowAppErrorToastOptions) => void;
  /** Critical failure: full modal with Retry / Go back / Contact support */
  showCriticalModal: (payload: CriticalPayload) => void;
  dismissCriticalModal: () => void;
};

const ErrorHandlerContext = React.createContext<ErrorHandlerContextValue | null>(null);

export function ErrorHandler({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [critical, setCritical] = React.useState<CriticalPayload | null>(null);

  const toastError = React.useCallback(
    (options: ShowAppErrorToastOptions) => {
      showAppErrorToast(toast, options);
    },
    [toast]
  );

  const showCriticalModal = React.useCallback((payload: CriticalPayload) => {
    logClientError(payload.context ?? "showCriticalModal", payload.error, {
      flow: payload.flow,
    });
    setCritical(payload);
  }, []);

  const dismissCriticalModal = React.useCallback(() => {
    setCritical(null);
  }, []);

  const value = React.useMemo(
    () => ({
      toastError,
      showCriticalModal,
      dismissCriticalModal,
    }),
    [toastError, showCriticalModal, dismissCriticalModal]
  );

  const friendly = critical
    ? getFriendlyError(critical.flow, critical.error)
    : null;

  return (
    <ErrorHandlerContext.Provider value={value}>
      {children}
      {friendly && critical && (
        <AppErrorModal
          open
          onOpenChange={(o) => {
            if (!o) setCritical(null);
          }}
          title={friendly.title}
          description={friendly.description}
          nextAction={friendly.nextAction}
          onRetry={critical.onRetry}
          onBack={critical.onBack}
        />
      )}
    </ErrorHandlerContext.Provider>
  );
}

export function useErrorHandler(): ErrorHandlerContextValue {
  const ctx = React.useContext(ErrorHandlerContext);
  if (!ctx) {
    throw new Error("useErrorHandler must be used within <ErrorHandler>");
  }
  return ctx;
}

/**
 * Safe variant when `ErrorHandler` is not mounted (e.g. tests). Prefer `useErrorHandler` in app routes.
 */
export function useErrorHandlerOptional(): ErrorHandlerContextValue | null {
  return React.useContext(ErrorHandlerContext);
}
