"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import {
  searchPromoToolUsers,
  getPromoToolUserDetail,
  resetUserLaunchPromoCounters,
  extendGlobalLaunchPromo30Days,
  forceEndGlobalLaunchPromo,
  undoLastGlobalLaunchPromoChange,
  undoLastUserLaunchPromoCounterReset,
  type PromoToolSearchUser,
  type PromoToolDetailResult,
} from "@/lib/actions/admin-promo-tools";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "PPpp");
  } catch {
    return iso;
  }
}

export function AdminPromoToolsPanel() {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PromoToolSearchUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PromoToolDetailResult | null>(null);

  const runSearch = useCallback(() => {
    startTransition(async () => {
      const r = await searchPromoToolUsers(query);
      if (!r.ok) {
        toast({ variant: "destructive", title: "Search failed", description: r.error });
        return;
      }
      setResults(r.users);
      if (r.users.length === 0) {
        toast({ title: "No matches", description: "Try another email, name, or user UUID." });
      }
    });
  }, [query, toast]);

  const loadDetail = useCallback(
    (userId: string) => {
      setSelectedId(userId);
      startTransition(async () => {
        const d = await getPromoToolUserDetail(userId);
        setDetail(d);
        if (!d.ok) {
          toast({ variant: "destructive", title: "Could not load user", description: d.error });
        }
      });
    },
    [toast]
  );

  const refreshDetail = useCallback(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  return (
    <div className="space-y-6">
      <Alert variant="warning">
        <p className="mb-1.5 font-semibold leading-none">Super admin only</p>
        <AlertDescription>
          Global actions (extend / force end) change{" "}
          <strong className="font-medium">site-wide</strong> promo settings for all users. Every
          change is written to the{" "}
          <Link href="/admin/activity" className="font-medium underline underline-offset-2">
            activity log
          </Link>
          . Use <strong className="font-medium">Undo</strong> to restore the previous global state or
          user counters from the last logged action.
        </AlertDescription>
      </Alert>

      <Card className="border-border dark:border-gray-800">
        <CardHeader>
          <CardTitle>Find user</CardTitle>
          <CardDescription>
            Search by email fragment, full name, or paste a user UUID. At least two characters.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="promo-search" className="text-sm font-medium text-foreground">
              Search
            </label>
            <Input
              id="promo-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="name@example.com or Jane Doe"
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
          </div>
          <Button type="button" onClick={runSearch} disabled={pending || query.trim().length < 2}>
            Search
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 ? (
        <Card className="border-border dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
            <CardDescription>Choose a user to view promo counters and run per-user tools.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => loadDetail(u.id)}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 dark:border-gray-800 dark:hover:bg-gray-900/80"
              >
                <span className="font-medium text-foreground dark:text-gray-100">
                  {u.full_name?.trim() || "—"}{" "}
                  <span className="font-normal text-muted-foreground">({u.id.slice(0, 8)}…)</span>
                </span>
                <span className="text-muted-foreground">{u.email ?? "No email on file"}</span>
                <span className="text-xs text-muted-foreground">
                  Lister promo jobs used: {u.launch_promo_lister_jobs_used} · Cleaner:{" "}
                  {u.launch_promo_cleaner_jobs_used}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {detail?.ok ? (
        <>
          <Card className="border-border dark:border-gray-800">
            <CardHeader>
              <CardTitle>User promo status</CardTitle>
              <CardDescription>
                Per-user counters track fee-free completions. Site-wide window comes from Global
                settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium text-foreground dark:text-gray-100">
                    {detail.user.full_name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground dark:text-gray-100">
                    {detail.user.email ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Account created</p>
                  <p className="font-medium text-foreground dark:text-gray-100">
                    {formatWhen(detail.user.account_created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">User id</p>
                  <p className="break-all font-mono text-xs text-foreground dark:text-gray-100">
                    {detail.user.id}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 dark:border-gray-800 dark:bg-gray-900/40">
                <p className="font-medium text-foreground dark:text-gray-100">Promo jobs used</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                  <li>
                    Lister (0% fee completions):{" "}
                    <strong className="text-foreground dark:text-gray-100">
                      {detail.user.launch_promo_lister_jobs_used}
                    </strong>{" "}
                    — slots remaining (if window open):{" "}
                    <strong className="text-foreground dark:text-gray-100">
                      {detail.user.lister_slots_remaining}
                    </strong>
                  </li>
                  <li>
                    Cleaner (paired completions):{" "}
                    <strong className="text-foreground dark:text-gray-100">
                      {detail.user.launch_promo_cleaner_jobs_used}
                    </strong>{" "}
                    — slots remaining:{" "}
                    <strong className="text-foreground dark:text-gray-100">
                      {detail.user.cleaner_slots_remaining}
                    </strong>
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-dashed border-border p-3 dark:border-gray-700">
                <p className="font-medium text-foreground dark:text-gray-100">Global promo window</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>
                    Active flag:{" "}
                    <strong className="text-foreground dark:text-gray-100">
                      {detail.global.launch_promo_active ? "on" : "off"}
                    </strong>{" "}
                    · Computed open:{" "}
                    <strong className="text-foreground dark:text-gray-100">
                      {detail.global.promo_window_open ? "yes" : "no"}
                    </strong>
                  </li>
                  <li>
                    Free job slots (global default):{" "}
                    <strong className="text-foreground dark:text-gray-100">
                      {detail.global.launch_promo_free_job_slots}
                    </strong>
                  </li>
                  <li>
                    Scheduled end: {formatWhen(detail.global.launch_promo_ends_at)}
                    {detail.global.days_remaining_calendar != null ? (
                      <>
                        {" "}
                        · Calendar days until end (UTC math):{" "}
                        <strong className="text-foreground dark:text-gray-100">
                          {detail.global.days_remaining_calendar}
                        </strong>
                      </>
                    ) : (
                      <span className="text-muted-foreground"> · No fixed end date in settings</span>
                    )}
                  </li>
                </ul>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    if (
                      !confirm(
                        "Reset this user’s lister and cleaner launch promo counters to 0? This is for testing only."
                      )
                    )
                      return;
                    startTransition(async () => {
                      const r = await resetUserLaunchPromoCounters(detail.user.id);
                      if (!r.ok) {
                        toast({ variant: "destructive", title: "Reset failed", description: r.error });
                        return;
                      }
                      toast({ title: "Counters reset", description: "Lister and cleaner counts set to 0." });
                      refreshDetail();
                    });
                  }}
                >
                  Reset promo counters to 0
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const r = await undoLastUserLaunchPromoCounterReset(detail.user.id);
                      if (!r.ok) {
                        toast({
                          variant: "destructive",
                          title: "Undo failed",
                          description: r.error,
                        });
                        return;
                      }
                      toast({
                        title: "Counters restored",
                        description: "Values from the last reset entry in the activity log.",
                      });
                      refreshDetail();
                    });
                  }}
                >
                  Undo last counter reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="text-base text-amber-950 dark:text-amber-100">
                Global promo (all users)
              </CardTitle>
              <CardDescription className="text-amber-900/80 dark:text-amber-200/80">
                These buttons update row <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/40">global_settings.id = 1</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (
                    !confirm(
                      "Extend site-wide promo end date by 30 days from the current end (or from today if no end is set), and turn the promo active flag on?"
                    )
                  )
                    return;
                  startTransition(async () => {
                    const r = await extendGlobalLaunchPromo30Days();
                    if (!r.ok) {
                      toast({ variant: "destructive", title: "Extend failed", description: r.error });
                      return;
                    }
                    toast({
                      title: "Promo extended",
                      description: `New end: ${formatWhen(r.new_launch_promo_ends_at)}`,
                    });
                    refreshDetail();
                  });
                }}
              >
                Extend promo by 30 days
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  if (
                    !confirm(
                      "Force-end the launch promo for everyone? Sets active = false and end time = now. Logged; you can undo once from the button below."
                    )
                  )
                    return;
                  startTransition(async () => {
                    const r = await forceEndGlobalLaunchPromo();
                    if (!r.ok) {
                      toast({ variant: "destructive", title: "Force end failed", description: r.error });
                      return;
                    }
                    toast({ title: "Promo force-ended", description: "Global settings updated." });
                    refreshDetail();
                  });
                }}
              >
                Force end promo
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const r = await undoLastGlobalLaunchPromoChange();
                    if (!r.ok) {
                      toast({ variant: "destructive", title: "Undo failed", description: r.error });
                      return;
                    }
                    toast({
                      title: "Global promo restored",
                      description: "Re-applied the snapshot from the last extend/force-end log entry.",
                    });
                    refreshDetail();
                  });
                }}
              >
                Undo last global change
              </Button>
            </CardContent>
          </Card>
        </>
      ) : detail && !detail.ok ? (
        <Alert variant="destructive">
          <p className="mb-1.5 font-semibold leading-none">Error</p>
          <AlertDescription>{detail.error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
