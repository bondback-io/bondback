"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { verifyUser } from "@/lib/actions/verification";
import type { VerificationBadgeType } from "@/lib/verification-badges";

const OPTIONS: Array<{ id: VerificationBadgeType; label: string }> = [
  { id: "abn_verified", label: "ABN Verified" },
  { id: "email_verified", label: "Email Verified" },
  { id: "trusted_cleaner", label: "Trusted Cleaner" },
  { id: "verified_lister", label: "Verified Lister" },
];

export function AdminUserVerificationActions({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [badgeType, setBadgeType] = useState<VerificationBadgeType>("abn_verified");
  const [mode, setMode] = useState<"verify" | "unverify">("verify");
  const [submitting, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={() => setOpen(true)}
      >
        Verify
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px] dark:border-gray-700 dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Manage user verification</DialogTitle>
            <DialogDescription>
              Manually verify or remove a verification badge for this user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground dark:text-gray-400">Action</p>
              <Select value={mode} onValueChange={(v) => setMode(v as "verify" | "unverify")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="verify">Manually Verify</SelectItem>
                  <SelectItem value="unverify">Unverify</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground dark:text-gray-400">Badge type</p>
              <Select
                value={badgeType}
                onValueChange={(v) => setBadgeType(v as VerificationBadgeType)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              disabled={submitting}
              onClick={() => {
                startTransition(async () => {
                  const res = await verifyUser(userId, badgeType, mode === "verify");
                  if (!res.ok) {
                    toast({ variant: "destructive", title: "Failed", description: res.error });
                    return;
                  }
                  toast({
                    title: mode === "verify" ? "User verified" : "Badge removed",
                    description: "Verification badge updated.",
                  });
                  setOpen(false);
                });
              }}
            >
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

