"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminSetCleanerNegativeStars } from "@/lib/actions/admin-users";
import { useToast } from "@/components/ui/use-toast";

export function AdminCleanerReputationPanel({
  userId,
  initialNegativeStars,
  banUntilIso,
  bannedReason,
  marketplaceBanActive,
}: {
  userId: string;
  initialNegativeStars: number;
  banUntilIso: string | null;
  bannedReason: string | null;
  marketplaceBanActive: boolean;
}) {
  const [stars, setStars] = useState(String(initialNegativeStars));
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-card/40 p-4 dark:border-gray-800 dark:bg-gray-900/40"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(stars);
        start(async () => {
          const res = await adminSetCleanerNegativeStars(userId, n);
          if (res.ok) {
            toast({ title: "Saved", description: "Negative stars updated." });
            router.refresh();
          } else {
            toast({ variant: "destructive", title: "Could not save", description: res.error });
          }
        });
      }}
    >
      <p className="text-sm font-medium dark:text-gray-100">Cleaner reputation</p>
      <p className="text-xs text-muted-foreground dark:text-gray-400">
        Strikes from lister escrow cancellations (non-responsive). To lift a marketplace ban, use{" "}
        <strong>Unban</strong> in the user actions menu (clears timed ban flags).
      </p>
      {marketplaceBanActive ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Marketplace ban active
          {banUntilIso
            ? ` until ${new Date(banUntilIso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
            : ""}
          {bannedReason ? ` — ${bannedReason}` : ""}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="admin-neg-stars" className="text-xs">
            Negative stars (0–99)
          </Label>
          <Input
            id="admin-neg-stars"
            type="number"
            min={0}
            max={99}
            value={stars}
            onChange={(e) => setStars(e.target.value)}
            className="h-9 w-28 font-mono text-sm"
          />
        </div>
        <Button type="submit" size="sm" className="h-9" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
