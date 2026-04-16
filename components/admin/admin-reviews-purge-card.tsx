"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { adminPurgeReviewsWhereUserIsReviewee } from "@/lib/actions/admin-reviews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

export function AdminReviewsPurgeCard({ readOnly }: { readOnly: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = React.useState("");
  const [pending, setPending] = React.useState(false);

  return (
    <Card className="border-border dark:border-amber-900/40 dark:bg-gray-900/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base dark:text-gray-100">
          Remove all ratings received by a user
        </CardTitle>
        <CardDescription className="text-sm dark:text-gray-400">
          Deletes every review where this person is the <strong>reviewee</strong> (the rated party),
          then recomputes profile stars and counts. Use email, <code className="text-xs">@username</code>, or
          user UUID. Does not delete reviews they wrote as the reviewer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="purge-reviewee" className="text-xs dark:text-gray-300">
            User (email, @handle, or UUID)
          </Label>
          <Input
            id="purge-reviewee"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="bondback2026@gmail.com or @bond_back_pro"
            disabled={readOnly || pending}
            className="dark:border-gray-700 dark:bg-gray-950"
          />
        </div>
        <Button
          type="button"
          variant="destructive"
          size="default"
          disabled={readOnly || pending || !value.trim()}
          className="shrink-0"
          onClick={() => {
            if (readOnly) return;
            if (
              !window.confirm(
                "Delete every review received by this user and reset their public rating? This cannot be undone."
              )
            ) {
              return;
            }
            setPending(true);
            void (async () => {
              const res = await adminPurgeReviewsWhereUserIsReviewee({ identifier: value.trim() });
              setPending(false);
              if (!res.ok) {
                toast({
                  variant: "destructive",
                  title: "Could not remove reviews",
                  description: res.error,
                });
                return;
              }
              toast({
                title: "Reviews removed",
                description:
                  res.deleted > 0
                    ? `Deleted ${res.deleted} review(s). Profile ratings were recomputed.`
                    : "No review rows found; aggregates were recalculated anyway.",
              });
              setValue("");
              router.refresh();
            })();
          }}
        >
          {pending ? "Working…" : "Clear received reviews"}
        </Button>
      </CardContent>
    </Card>
  );
}
