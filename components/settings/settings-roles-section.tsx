"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { validateAbnIfRequired } from "@/lib/actions/validate-abn";
import { useToast } from "@/components/ui/use-toast";
import { Brush, Home } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  roles: string[];
  /** From `profiles.active_role` */
  activeRole: string | null;
};

const CLEANER_FEATURES = "bidding on jobs, getting hired, and earning from bond cleans (ABN required).";

/**
 * My Roles — large tap targets (mobile-first), switch active role or add the other role.
 * Cleaner icon: `Brush` (broom-style) — lucide has no `Broom` in this lockfile.
 */
export function SettingsRolesSection({ roles, activeRole }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [openCleaner, setOpenCleaner] = useState(false);
  const [abn, setAbn] = useState("");
  const [loadingUnlock, setLoadingUnlock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLister = roles.includes("lister");
  const hasCleaner = roles.includes("cleaner");

  const switchTo = (role: "lister" | "cleaner") => {
    startTransition(async () => {
      const result = await setActiveRole(role);
      if (!result.ok) {
        toast({ title: "Couldn’t switch", description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: role === "lister" ? "Lister mode" : "Cleaner mode",
        description: "Active role updated.",
      });
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
    <div id="my-roles" className="scroll-mt-24 space-y-4">
      <div>
        <h3 className="text-lg font-semibold tracking-tight dark:text-gray-100">My Roles</h3>
        <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
          One login — switch roles anytime. Add the other role to list jobs and clean.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Lister */}
        {hasLister ? (
          <Button
            type="button"
            size="lg"
            variant={activeRole === "lister" ? "secondary" : "outline"}
            className={cn(
              "min-h-14 w-full justify-between gap-3 px-4 py-4 text-left font-semibold",
              activeRole === "lister" && "border-2 border-sky-500/40 bg-sky-50 dark:border-sky-600/50 dark:bg-sky-950/40"
            )}
            disabled={isPending || activeRole === "lister"}
            onClick={() => activeRole !== "lister" && switchTo("lister")}
          >
            <span className="inline-flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/50">
                <Home className="h-6 w-6 text-sky-600 dark:text-sky-300" aria-hidden />
              </span>
              <span className="flex flex-col items-start gap-0.5">
                <span className="text-base">Lister</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Post bond cleans &amp; hire cleaners
                </span>
              </span>
            </span>
            {activeRole === "lister" ? (
              <Badge className="shrink-0 border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-900/60 dark:text-sky-100">
                Current
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0">
                Switch
              </Badge>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="min-h-14 w-full justify-start gap-3 bg-sky-600 px-4 py-4 text-base font-semibold text-white hover:bg-sky-600/90 dark:bg-sky-600"
            disabled={loadingUnlock}
            onClick={addListerOneTap}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Home className="h-6 w-6" aria-hidden />
            </span>
            <span className="flex flex-col items-start gap-0.5 text-left">
              <span>Add Lister role</span>
              <span className="text-xs font-normal text-white/90">
                List properties and hire cleaners
              </span>
            </span>
          </Button>
        )}

        {/* Cleaner */}
        {hasCleaner ? (
          <Button
            type="button"
            size="lg"
            variant={activeRole === "cleaner" ? "secondary" : "outline"}
            className={cn(
              "min-h-14 w-full justify-between gap-3 px-4 py-4 text-left font-semibold",
              activeRole === "cleaner" &&
                "border-2 border-emerald-500/40 bg-emerald-50 dark:border-emerald-600/50 dark:bg-emerald-950/40"
            )}
            disabled={isPending || activeRole === "cleaner"}
            onClick={() => activeRole !== "cleaner" && switchTo("cleaner")}
          >
            <span className="inline-flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                <Brush className="h-6 w-6 text-emerald-700 dark:text-emerald-300" aria-hidden />
              </span>
              <span className="flex flex-col items-start gap-0.5">
                <span className="text-base">Cleaner</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Bid on jobs &amp; earn payouts
                </span>
              </span>
            </span>
            {activeRole === "cleaner" ? (
              <Badge className="shrink-0 border-emerald-200 bg-emerald-100 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100">
                Current
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0">
                Switch
              </Badge>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="min-h-14 w-full justify-start gap-3 border-2 border-emerald-600/40 px-4 py-4 text-left text-base font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
            disabled={loadingUnlock}
            onClick={() => {
              setAbn("");
              setError(null);
              setOpenCleaner(true);
            }}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
              <Brush className="h-6 w-6 text-emerald-700 dark:text-emerald-300" aria-hidden />
            </span>
            <span className="flex flex-col items-start gap-0.5">
              <span>Add Cleaner role</span>
              <span className="text-xs font-normal text-muted-foreground">
                ABN required (11 digits)
              </span>
            </span>
          </Button>
        )}
      </div>

      {error && !openCleaner && (
        <p className="text-sm text-destructive dark:text-red-300" role="alert">
          {error}
        </p>
      )}

      <Dialog open={openCleaner} onOpenChange={(o) => !o && setOpenCleaner(false)}>
        <DialogContent className="dark:border-gray-800 dark:bg-gray-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Add Cleaner role</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              You&apos;ll gain access to {CLEANER_FEATURES}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="settings-unlock-abn" className="dark:text-gray-300">
              ABN (11 digits)
            </Label>
            <Input
              id="settings-unlock-abn"
              inputMode="numeric"
              maxLength={11}
              placeholder="e.g. 12345678901"
              value={abn}
              onChange={(e) => setAbn(e.target.value.replace(/\D/g, "").slice(0, 11))}
              className="min-h-12 text-base dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          {error && openCleaner && (
            <p className="text-sm text-destructive dark:text-red-200">{error}</p>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-12 w-full sm:w-auto"
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
              {loadingUnlock ? "Adding…" : "Add Cleaner role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
