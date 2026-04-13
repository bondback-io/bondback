"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSupportContactDisplayEmail } from "@/components/providers/support-contact-provider";
import { cn } from "@/lib/utils";

export type AppErrorModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What went wrong + context */
  description: string;
  /** Clear next step */
  nextAction: string;
  onRetry?: () => void;
  /** e.g. router.back — optional */
  onBack?: () => void;
  supportEmail?: string;
};

/**
 * Full-screen style on mobile: calm slate/emerald tone — informative, not alarming.
 */
export function AppErrorModal({
  open,
  onOpenChange,
  title,
  description,
  nextAction,
  onRetry,
  onBack,
  supportEmail: supportEmailProp,
}: AppErrorModalProps) {
  const supportEmailFallback = useSupportContactDisplayEmail();
  const supportEmail = supportEmailProp ?? supportEmailFallback;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(90vh,28rem)] gap-4 border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/95 sm:max-w-md",
          "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:max-h-[85vh] max-md:translate-y-0 max-md:rounded-t-2xl max-md:border-x-0 max-md:border-b-0"
        )}
      >
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {title}
          </DialogTitle>
          <DialogDescription className="space-y-3 text-base text-slate-700 dark:text-slate-300">
            <span className="block leading-relaxed">{description}</span>
            <span className="block rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2.5 text-sm leading-relaxed text-slate-700 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-200">
              <span className="font-medium text-slate-800 dark:text-slate-100">Next step: </span>
              {nextAction}
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-stretch sm:gap-2">
          {onBack && (
            <Button type="button" variant="outline" className="w-full sm:flex-1" onClick={onBack}>
              Go back
            </Button>
          )}
          {onRetry && (
            <Button
              type="button"
              className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:flex-1"
              onClick={() => {
                onRetry();
                onOpenChange(false);
              }}
            >
              Retry
            </Button>
          )}
          <Button type="button" variant="ghost" className="w-full sm:flex-1" asChild>
            <Link href={`mailto:${supportEmail}?subject=Bond%20Back%20help`}>Contact support</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
