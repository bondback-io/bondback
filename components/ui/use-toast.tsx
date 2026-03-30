"use client";

import * as React from "react";
import Link from "next/link";
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast";

type ToastVariant = "default" | "destructive" | "muted";

export type ToastAction = { label: string; href: string };

export type ToastActionButton = { label: string; onClick: () => void };

export type ToastOptions = {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  /** Optional action button (e.g. "View" linking to job) */
  action?: ToastAction;
  /** Optional button (e.g. Undo) — avoids full page navigation */
  actionButton?: ToastActionButton;
};

type ToastContextValue = {
  toasts: ToastOptions[];
  toast: (options: ToastOptions) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

let idCounter = 0;

export function ToastProviderWithContext({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastOptions[]>([]);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toast = (options: ToastOptions) => {
    const id = options.id ?? `toast-${++idCounter}`;
    setToasts((prev) => [...prev, { ...options, id }]);
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      <ToastProvider>
        {children}
        <ToastViewport />
        {toasts.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            onOpenChange={(open) => {
              if (!open && t.id) dismiss(t.id);
            }}
          >
            {t.title && <ToastTitle>{t.title}</ToastTitle>}
            {t.description && (
              <ToastDescription>{t.description}</ToastDescription>
            )}
            {t.actionButton && (
              <div className="mt-2">
                <button
                  type="button"
                  className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15 dark:bg-primary/20 dark:hover:bg-primary/30"
                  onClick={() => {
                    t.actionButton?.onClick();
                    if (t.id) dismiss(t.id);
                  }}
                >
                  {t.actionButton.label}
                </button>
              </div>
            )}
            {t.action && !t.actionButton && (
              <div className="mt-2">
                <Link
                  href={t.action.href}
                  className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
                  onClick={() => t.id && dismiss(t.id)}
                >
                  {t.action.label}
                </Link>
              </div>
            )}
          </Toast>
        ))}
      </ToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProviderWithContext>");
  }
  return ctx;
}

