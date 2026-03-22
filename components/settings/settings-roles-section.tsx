"use client";

import { useState } from "react";
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
import { validateAbnIfRequired } from "@/lib/actions/validate-abn";
import { useToast } from "@/components/ui/use-toast";
import { Briefcase, Home } from "lucide-react";

type Props = {
  roles: string[];
};

const LISTER_FEATURES = "listing bond clean jobs, receiving bids, and hiring cleaners.";
const CLEANER_FEATURES = "bidding on jobs, getting hired, and earning from bond cleans (ABN required).";

export function SettingsRolesSection({ roles }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<"lister" | "cleaner" | null>(null);
  const [abn, setAbn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLister = roles.includes("lister");
  const hasCleaner = roles.includes("cleaner");

  const openUnlock = (role: "lister" | "cleaner") => {
    setUnlockTarget(role);
    setAbn("");
    setError(null);
    setOpen(true);
  };

  const closeUnlock = () => {
    setOpen(false);
    setUnlockTarget(null);
    setAbn("");
    setError(null);
  };

  const handleUnlock = async () => {
    if (!unlockTarget) return;
    if (unlockTarget === "cleaner") {
      const trimmed = abn.trim().replace(/\D/g, "");
      if (trimmed.length !== 11) {
        setError("ABN must be 11 digits.");
        return;
      }
      setLoading(true);
      setError(null);
      const abrResult = await validateAbnIfRequired(trimmed);
      if (!abrResult.ok) {
        setError(abrResult.error);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const result = await unlockRole(unlockTarget, unlockTarget === "cleaner" ? abn.trim().replace(/\D/g, "") : undefined);
      if (result.ok) {
        toast({
          title: "Role unlocked!",
          description: `You've added ${unlockTarget === "lister" ? "Lister" : "Cleaner"} features.`,
        });
        closeUnlock();
        router.push(result.redirect);
        router.refresh();
        return;
      }
      setError(result.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <h4 className="text-sm font-medium dark:text-gray-200">Roles</h4>
        <div className="flex flex-wrap items-center gap-2">
          {hasLister && (
            <Badge variant="secondary" className="gap-1 dark:bg-gray-800 dark:text-gray-200">
              <Home className="h-3 w-3" />
              Lister
            </Badge>
          )}
          {hasCleaner && (
            <Badge variant="secondary" className="gap-1 dark:bg-gray-800 dark:text-gray-200">
              <Briefcase className="h-3 w-3" />
              Cleaner
            </Badge>
          )}
          {!hasLister && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 dark:border-gray-700 dark:hover:bg-gray-800"
              onClick={() => openUnlock("lister")}
            >
              <Home className="h-3 w-3" />
              Unlock Lister
            </Button>
          )}
          {!hasCleaner && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 dark:border-gray-700 dark:hover:bg-gray-800"
              onClick={() => openUnlock("cleaner")}
            >
              <Briefcase className="h-3 w-3" />
              Unlock Cleaner
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground dark:text-gray-400">
          Add the other role to list jobs and clean. You can switch roles in the header.
        </p>
      </div>

      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeUnlock()}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">
              Unlock {unlockTarget === "lister" ? "Lister" : "Cleaner"}?
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              You&apos;ll gain access to{" "}
              {unlockTarget === "lister" ? LISTER_FEATURES : CLEANER_FEATURES}
            </DialogDescription>
          </DialogHeader>
          {unlockTarget === "cleaner" && (
            <div className="space-y-2">
              <Label htmlFor="unlock-abn" className="dark:text-gray-300">
                ABN (11 digits)
              </Label>
              <Input
                id="unlock-abn"
                inputMode="numeric"
                maxLength={11}
                placeholder="e.g. 12345678901"
                value={abn}
                onChange={(e) => setAbn(e.target.value.replace(/\D/g, "").slice(0, 11))}
                className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              />
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive dark:text-red-200">{error}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeUnlock} className="dark:border-gray-700 dark:hover:bg-gray-800">
              Cancel
            </Button>
            <Button
              onClick={handleUnlock}
              disabled={loading || (unlockTarget === "cleaner" && abn.trim().length !== 11)}
              className="dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              {loading ? "Unlocking…" : "Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
