"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockRole } from "@/lib/actions/onboarding";
import { setActiveRole } from "@/lib/actions/profile";
import { notifyActiveRoleChanged } from "@/lib/active-role-events";
import { validateAbnIfRequired } from "@/lib/actions/validate-abn";
import { useAbnLiveValidation } from "@/hooks/use-abn-live-validation";
import {
  AbnValidationInputRow,
  AbnLiveValidationMessages,
} from "@/components/features/abn-validation-ui";
import { useToast } from "@/components/ui/use-toast";
import { Brush, Home } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  roles: string[];
  /** From `profiles.active_role` */
  activeRole: string | null;
};

const CLEANER_FEATURES =
  "bidding on jobs, getting hired, and earning from bond cleans (ABN required).";

/**
 * My Roles — Card layout, segmented switch when dual-role, clear add-role CTAs.
 */
export function SettingsRolesSection({ roles, activeRole }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [openCleaner, setOpenCleaner] = useState(false);
  const [abn, setAbn] = useState("");
  const [loadingUnlock, setLoadingUnlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abnLiveValidation = useAbnLiveValidation(openCleaner ? abn : "");

  const hasLister = roles.includes("lister");
  const hasCleaner = roles.includes("cleaner");
  const dualRole = hasLister && hasCleaner;

  const switchTo = (role: "lister" | "cleaner") => {
    startTransition(async () => {
      const result = await setActiveRole(role);
      if (!result.ok) {
        toast({
          title: "Couldn’t switch",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: role === "lister" ? "Lister mode" : "Cleaner mode",
        description: "Active role updated.",
      });
      notifyActiveRoleChanged();
      const dest = role === "lister" ? "/lister/dashboard" : "/cleaner/dashboard";
      router.replace(dest);
      router.refresh();
    });
  };

  const addListerOneTap = () => {
    setLoadingUnlock(true);
    setError(null);
    unlockRole("lister")
      .then((result) => {
        if (result.ok) {
          toast({ title: "Lister role added", description: "Taking you to the next step." });
          router.push(result.redirect);
          router.refresh();
        } else {
          setError(result.error);
        }
      })
      .finally(() => setLoadingUnlock(false));
  };

  const submitCleanerUnlock = async () => {
    const trimmed = abn.trim().replace(/\D/g, "");
    if (trimmed.length !== 11) {
      setError("ABN must be 11 digits.");
      return;
    }
    setLoadingUnlock(true);
    setError(null);
    const abrResult = await validateAbnIfRequired(trimmed);
    if (!abrResult.ok) {
      setError(abrResult.error);
      setLoadingUnlock(false);
      return;
    }
    try {
      const result = await unlockRole("cleaner", trimmed);
      if (result.ok) {
        toast({ title: "Cleaner role added", description: "Taking you to the next step." });
        setOpenCleaner(false);
        setAbn("");
        router.push(result.redirect);
        router.refresh();
        return;
      }
      setError(result.error);
    } finally {
      setLoadingUnlock(false);
    }
  };

  return (
    <Card
      id="my-roles"
      className="scroll-mt-24 border-border/80 bg-card shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
    >
      <CardHeader className="space-y-1.5 pb-3 sm:pb-4">
        <CardTitle className="text-lg sm:text-base dark:text-gray-100">Switch role</CardTitle>
        <CardDescription className="text-base leading-relaxed text-muted-foreground sm:text-sm dark:text-gray-400">
          One login — pick which mode you&apos;re using. Add the other role anytime below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        {/* Dual role: segmented control */}
        {dualRole && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground dark:text-gray-200">Active mode</p>
            <div
              className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/50 p-1.5 dark:border-gray-800 dark:bg-gray-900/80"
              role="group"
              aria-label="Switch between Lister and Cleaner"
            >
              <button
                type="button"
                disabled={isPending || activeRole === "lister"}
                onClick={() => activeRole !== "lister" && switchTo("lister")}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-semibold transition-all sm:min-h-14",
                  "disabled:opacity-100",
                  activeRole === "lister"
                    ? "bg-background text-foreground shadow-md ring-1 ring-sky-500/40 dark:bg-gray-950 dark:text-gray-50 dark:ring-sky-500/50"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground active:scale-[0.99] dark:text-gray-200 dark:hover:bg-gray-800/80 dark:hover:text-gray-50"
                )}
              >
                <Home
                  className={cn(
                    "h-6 w-6",
                    activeRole === "lister"
                      ? "text-sky-600 dark:text-sky-400"
                      : "opacity-80 dark:opacity-90 dark:text-gray-300"
                  )}
                  aria-hidden
                />
                <span className={activeRole === "lister" ? "text-foreground dark:text-gray-50" : "dark:text-gray-200"}>
                  Lister
                </span>
              </button>
              <button
                type="button"
                disabled={isPending || activeRole === "cleaner"}
                onClick={() => activeRole !== "cleaner" && switchTo("cleaner")}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-semibold transition-all sm:min-h-14",
                  "disabled:opacity-100",
                  activeRole === "cleaner"
                    ? "bg-background text-foreground shadow-md ring-1 ring-emerald-500/40 dark:bg-gray-950 dark:text-gray-50 dark:ring-emerald-500/50"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground active:scale-[0.99] dark:text-gray-200 dark:hover:bg-gray-800/80 dark:hover:text-gray-50"
                )}
              >
                <Brush
                  className={cn(
                    "h-6 w-6",
                    activeRole === "cleaner"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "opacity-80 dark:opacity-90 dark:text-gray-300"
                  )}
                  aria-hidden
                />
                <span className={activeRole === "cleaner" ? "text-foreground dark:text-gray-50" : "dark:text-gray-200"}>
                  Cleaner
                </span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              Tip: You can also switch from the header on any page.
            </p>
          </div>
        )}

        {/* Add Lister (no lister yet) */}
        {!hasLister && (
          <div className="rounded-xl border border-dashed border-sky-300/60 bg-sky-50/50 p-4 dark:border-sky-800/60 dark:bg-sky-950/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/50">
                  <Home className="h-5 w-5 text-sky-700 dark:text-sky-300" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-foreground dark:text-gray-100">Add Lister role</p>
                  <p className="mt-0.5 text-sm text-muted-foreground dark:text-gray-400">
                    Post bond cleans and hire cleaners.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="lg"
                className="h-12 w-full shrink-0 sm:w-auto sm:min-w-[10rem]"
                disabled={loadingUnlock}
                onClick={addListerOneTap}
              >
                {loadingUnlock ? "Adding…" : "Add Lister"}
              </Button>
            </div>
          </div>
        )}

        {/* Add Cleaner (no cleaner yet) */}
        {!hasCleaner && (
          <div className="rounded-xl border border-dashed border-emerald-300/60 bg-emerald-50/50 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                  <Brush className="h-5 w-5 text-emerald-700 dark:text-emerald-300" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-foreground dark:text-gray-100">Add Cleaner role</p>
                  <p className="mt-0.5 text-sm text-muted-foreground dark:text-gray-400">
                    Bid on jobs (ABN required).
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="h-12 w-full border-2 border-emerald-600/50 bg-emerald-600 text-white hover:bg-emerald-600/90 dark:border-emerald-500/50 dark:bg-emerald-700 dark:text-white dark:hover:bg-emerald-600 sm:w-auto sm:min-w-[10rem]"
                disabled={loadingUnlock}
                onClick={() => {
                  setAbn("");
                  setError(null);
                  setOpenCleaner(true);
                }}
              >
                Add Cleaner
              </Button>
            </div>
          </div>
        )}

        {error && !openCleaner && (
          <p className="text-sm text-destructive dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <Dialog open={openCleaner} onOpenChange={(o) => !o && setOpenCleaner(false)}>
          <DialogContent className="sm:max-w-md dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-50">Add Cleaner role</DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                You&apos;ll gain access to {CLEANER_FEATURES}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="settings-unlock-abn" className="text-foreground dark:text-gray-200">
                ABN (11 digits)
              </Label>
              <AbnValidationInputRow
                id="settings-unlock-abn"
                inputMode="numeric"
                maxLength={11}
                placeholder="e.g. 12345678901"
                value={abn}
                onChange={(e) => setAbn(e.target.value.replace(/\D/g, "").slice(0, 11))}
                className="min-h-12 text-base dark:border-gray-700 dark:bg-gray-900"
                validation={abnLiveValidation}
              />
              <AbnLiveValidationMessages
                validation={abnLiveValidation}
                detailsId="settings-unlock-abn-validated-abn-details"
              />
            </div>
            {error && openCleaner && (
              <p className="text-sm text-destructive dark:text-red-400" role="alert">
                {error}
              </p>
            )}
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-12 w-full border-gray-600 bg-transparent sm:w-auto dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
                onClick={() => setOpenCleaner(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="lg"
                className="min-h-12 w-full sm:w-auto"
                disabled={loadingUnlock || abn.replace(/\D/g, "").length !== 11}
                onClick={submitCleanerUnlock}
              >
                {loadingUnlock ? "Adding…" : "Confirm & add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
