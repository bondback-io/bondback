"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  RotateCcw,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  checkAndFixSeo,
  generateSeoForSuburbs,
  getSeoProgress,
  resetSeoForRegion,
  resetSeoForSuburb,
  type SeoProgressResult,
} from "@/lib/actions/seo-automation";
import { getSeoManualTaskState, setSeoGscSubmitted } from "@/lib/actions/seo-gsc";
import {
  mergeNewGscUrls,
  SeoGscSubmissionCard,
  type GscUrlEntry,
} from "@/components/admin/seo-gsc-submission-card";
import {
  SEO_GENERATION_STEPS,
  SeoGenerationProgressModal,
  type SeoGenerationStepId,
} from "@/components/admin/seo-generation-progress-modal";
import { SeoManualPostGenerationSection } from "@/components/admin/seo-manual-post-generation-section";
import type { SeoAutomationRegion, SeoAutomationSuburb } from "@/lib/seo/load-seo-automation-data";
import { cn } from "@/lib/utils";

type Props = {
  regions: SeoAutomationRegion[];
  suburbs: SeoAutomationSuburb[];
};

const STEP_IDS = SEO_GENERATION_STEPS.map((s) => s.id);
const MAX_SELECT = 3;

function defaultRegionSlug(regions: SeoAutomationRegion[]): string {
  const sc = regions.find((r) => r.slug === "sunshine-coast");
  return sc?.slug ?? regions[0]?.slug ?? "";
}

export function AdminSeoAutomationPanel({ regions, suburbs }: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [regionSlug, setRegionSlug] = useState(() => defaultRegionSlug(regions));
  const [progress, setProgress] = useState<SeoProgressResult | null>(null);
  const [loadPending, setLoadPending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [workingSuburbId, setWorkingSuburbId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalPhase, setModalPhase] = useState<"running" | "success" | "error">("running");
  const [modalProgress, setModalProgress] = useState(0);
  const [activeStep, setActiveStep] = useState<SeoGenerationStepId>("landing");
  const [modalError, setModalError] = useState<string | null>(null);

  const [gscPendingUrls, setGscPendingUrls] = useState<GscUrlEntry[]>([]);
  const [gscSubmittedAt, setGscSubmittedAt] = useState<string | null>(null);

  const selectedRegion = useMemo(
    () => regions.find((r) => r.slug === regionSlug),
    [regions, regionSlug]
  );

  const suburbsInRegion = useMemo(() => {
    const list = suburbs.filter((s) => s.region_id === selectedRegion?.id);
    return [...list].sort((a, b) => a.priority - b.priority);
  }, [suburbs, selectedRegion?.id]);

  const refreshProgress = useCallback(() => {
    if (!regionSlug) return;
    setLoadPending(true);
    startTransition(async () => {
      const res = await getSeoProgress(regionSlug);
      setLoadPending(false);
      if ("ok" in res && res.ok === true) {
        setProgress(res);
      } else if ("ok" in res && res.ok === false) {
        toast({ variant: "destructive", title: "Could not load progress", description: res.error });
      }
    });
  }, [regionSlug, toast]);

  useEffect(() => {
    refreshProgress();
  }, [refreshProgress]);

  const loadGscState = useCallback(async () => {
    if (!regionSlug) return;
    const res = await getSeoManualTaskState(regionSlug);
    if (res.ok) setGscSubmittedAt(res.gscSubmittedAt);
  }, [regionSlug]);

  useEffect(() => {
    void loadGscState();
  }, [loadGscState]);

  useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(`bondback_gsc_pending_${regionSlug}`);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setGscPendingUrls(
            parsed.filter(
              (e): e is GscUrlEntry =>
                e != null &&
                typeof e === "object" &&
                typeof (e as GscUrlEntry).url === "string" &&
                typeof (e as GscUrlEntry).selected === "boolean"
            )
          );
        } else {
          setGscPendingUrls([]);
        }
      } else {
        setGscPendingUrls([]);
      }
    } catch {
      setGscPendingUrls([]);
    }
  }, [regionSlug]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`bondback_gsc_pending_${regionSlug}`, JSON.stringify(gscPendingUrls));
    } catch {
      /* quota / private mode */
    }
  }, [gscPendingUrls]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [regionSlug]);

  const handleGscMarkSubmitted = useCallback(
    (completed: boolean) => {
      if (!regionSlug) return;
      startTransition(async () => {
        const res = await setSeoGscSubmitted({ regionSlug, completed });
        if (!res.ok) {
          toast({ variant: "destructive", title: "Could not update GSC task", description: res.error });
          return;
        }
        setGscSubmittedAt(res.completedAt ?? null);
      });
    },
    [regionSlug, toast]
  );

  const selectedCount = selectedIds.size;
  const canGenerate = selectedCount > 0 && selectedCount <= MAX_SELECT;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= MAX_SELECT) {
        toast({
          title: "Selection limit",
          description: `You can select at most ${MAX_SELECT} suburbs per generation run.`,
        });
        return prev;
      }
      next.add(id);
      return next;
    });
  };

  const runGeneration = () => {
    const ids = Array.from(selectedIds);
    if (!canGenerate) return;

    setModalOpen(true);
    setModalPhase("running");
    setModalError(null);
    setModalProgress(8);
    setActiveStep("landing");

    let stepIdx = 0;
    const advance = () => {
      stepIdx = Math.min(stepIdx + 1, STEP_IDS.length - 1);
      setActiveStep(STEP_IDS[stepIdx] ?? "landing");
      setModalProgress(10 + Math.round((stepIdx / (STEP_IDS.length - 1)) * 78));
    };
    const interval = setInterval(advance, 1400);

    startTransition(async () => {
      try {
        const res = await generateSeoForSuburbs(ids);
        clearInterval(interval);
        if (!res.ok) {
          setModalPhase("error");
          setModalError(res.error);
          return;
        }
        setModalProgress(100);
        setActiveStep("routing");
        setModalPhase("success");
        toast({ title: "SEO generated", description: `${res.generated.length} suburb(s) updated.` });
        setSelectedIds(new Set());
        const newUrls = res.generated.flatMap((g) => [g.pageUrl, ...g.extraUrls]);
        setGscPendingUrls((prev) => mergeNewGscUrls(prev, newUrls));
        refreshProgress();
        setTimeout(() => {
          setModalOpen(false);
          setModalPhase("running");
        }, 1600);
      } catch (e) {
        clearInterval(interval);
        setModalPhase("error");
        setModalError(e instanceof Error ? e.message : "Unknown error");
      }
    });
  };

  const handleCheckFix = (suburbId: string) => {
    setWorkingSuburbId(suburbId);
    startTransition(async () => {
      const res = await checkAndFixSeo(suburbId);
      setWorkingSuburbId(null);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Check & fix failed", description: res.error });
        return;
      }
      toast({ title: "Checked & fixed", description: "Content normalized and cached paths refreshed." });
      refreshProgress();
    });
  };

  const handleResetSuburb = (suburbId: string, label: string) => {
    if (!confirm(`Reset generated SEO for ${label}? This removes stored content for this suburb.`)) return;
    setWorkingSuburbId(suburbId);
    startTransition(async () => {
      const res = await resetSeoForSuburb(suburbId);
      setWorkingSuburbId(null);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Reset failed", description: res.error });
        return;
      }
      toast({ title: "Suburb reset" });
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(suburbId);
        return n;
      });
      refreshProgress();
    });
  };

  const handleResetRegion = () => {
    if (!selectedRegion?.id) return;
    if (
      !confirm(
        "Remove all generated SEO content for this entire region and reset every suburb? This cannot be undone."
      )
    )
      return;
    startTransition(async () => {
      const res = await resetSeoForRegion(selectedRegion.id);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Reset failed", description: res.error });
        return;
      }
      toast({ title: "Region reset" });
      setSelectedIds(new Set());
      refreshProgress();
    });
  };

  if (regions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">SEO management</CardTitle>
          <CardDescription>
            Run <code className="text-xs">scripts/seo_regions_suburbs_migration.sql</code>,{" "}
            <code className="text-xs">scripts/seo_regions_suburbs_qld_expand.sql</code> (extra QLD regions), and{" "}
            <code className="text-xs">scripts/seo_content_migration.sql</code> in Supabase, then reload.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const completionPct = progress?.completionPct ?? 0;

  return (
    <>
      <SeoGenerationProgressModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        phase={modalPhase}
        progress={modalProgress}
        activeStepId={activeStep}
        errorMessage={modalError}
      />

      <div className="space-y-6">
        <Card className="overflow-hidden border-emerald-200/60 shadow-sm dark:border-emerald-900/40">
          <CardHeader className="space-y-4 border-b border-border/60 bg-gradient-to-br from-emerald-50/90 to-background pb-6 dark:border-gray-800 dark:from-emerald-950/30 dark:to-gray-950">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                    SEO management
                  </CardTitle>
                </div>
                <CardDescription className="max-w-2xl text-sm leading-relaxed">
                  Select a region, choose up to three suburbs, then generate landing content, articles, and FAQ
                  schema stored in Supabase. Progress is tracked per region.
                </CardDescription>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px]">
                <Label htmlFor="seo-region" className="text-xs font-medium text-muted-foreground">
                  Region
                </Label>
                <Select value={regionSlug} onValueChange={setRegionSlug}>
                  <SelectTrigger id="seo-region" className="w-full bg-background">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.slug}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                <span>Region progress</span>
                <span className="tabular-nums">{completionPct}%</span>
              </div>
              <Progress
                value={completionPct}
                className="h-2.5 bg-emerald-100/80 dark:bg-emerald-950/60"
                indicatorClassName="bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500"
              />
              <p className="text-xs text-muted-foreground">
                {progress ? (
                  <>
                    {progress.completed} of {progress.total} suburbs completed for{" "}
                    <span className="font-medium text-foreground">{progress.regionName}</span>
                  </>
                ) : loadPending ? (
                  "Loading…"
                ) : (
                  "Select a region to view progress."
                )}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Selected:{" "}
                <span className="font-mono font-medium text-foreground">
                  {selectedCount}/{MAX_SELECT}
                </span>{" "}
                suburbs
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadPending || pending}
                  onClick={refreshProgress}
                >
                  {loadPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="min-h-12 w-full bg-emerald-600 px-8 text-base font-semibold hover:bg-emerald-700 sm:w-auto dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  disabled={pending || !canGenerate}
                  onClick={runGeneration}
                >
                  {pending && modalOpen ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" aria-hidden />
                      Generate SEO
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="border-t border-border/60 dark:border-gray-800" role="presentation" />

            <div>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Suburbs</h3>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card/40 dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900/20">
                {suburbsInRegion.map((s) => {
                  const st = progress?.suburbs.find((x) => x.id === s.id);
                  const completed = st?.completed ?? s.completed;
                  const isSelected = selectedIds.has(s.id);
                  const busy = workingSuburbId === s.id;

                  return (
                    <li
                      key={s.id}
                      className={cn(
                        "flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                        completed && "bg-emerald-50/40 dark:bg-emerald-950/15"
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <Checkbox
                          id={`suburb-${s.id}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(s.id)}
                          disabled={pending && modalOpen}
                          className="mt-1"
                          aria-label={`Select ${s.suburb_name}`}
                        />
                        <div className="min-w-0 flex-1">
                          <Label
                            htmlFor={`suburb-${s.id}`}
                            className="cursor-pointer text-base font-medium leading-tight"
                          >
                            <span className="mr-2 font-mono text-xs text-muted-foreground tabular-nums">
                              {s.priority}.
                            </span>
                            {s.suburb_name}
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                              {s.postcode}
                            </span>
                          </Label>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {completed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                                Completed
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not generated</span>
                            )}
                            {st?.pageSlug ? (
                              <code className="hidden max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-[10px] sm:inline">
                                /bond-cleaning/{st.pageSlug}
                              </code>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 pl-8 sm:justify-end sm:pl-0">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="min-w-0"
                          disabled={busy || (pending && modalOpen)}
                          onClick={() => handleCheckFix(s.id)}
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                          <span className="ml-1.5 hidden sm:inline">Check &amp; fix</span>
                          <span className="ml-1.5 sm:hidden">Fix</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={busy || (pending && modalOpen)}
                          onClick={() => handleResetSuburb(s.id, s.suburb_name)}
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="ml-1.5">Reset</span>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 dark:border-red-900/50 dark:bg-red-950/20">
              <p className="mb-3 text-sm font-medium text-destructive dark:text-red-300">
                Reset entire region
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                Deletes all generated <code className="text-[10px]">seo_content</code> rows for every suburb in
                this region and clears completion flags.
              </p>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={pending}
                onClick={handleResetRegion}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset entire region
              </Button>
            </div>
          </CardContent>
        </Card>

        {selectedRegion && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Manual actions required</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Post-generation work that cannot be fully automated. The URL list below updates when you run{" "}
                <strong>Generate SEO</strong>; marking GSC submission is saved to your account.
              </p>
            </div>
            <SeoGscSubmissionCard
              regionSlug={selectedRegion.slug}
              regionName={selectedRegion.name}
              pendingUrls={gscPendingUrls}
              onPendingUrlsChange={setGscPendingUrls}
              submittedAt={gscSubmittedAt}
              onSubmittedAtChange={setGscSubmittedAt}
              onRefresh={loadGscState}
            />
            <SeoManualPostGenerationSection
              regionSlug={selectedRegion.slug}
              regionName={selectedRegion.name}
              embedded
              gscSubmittedAt={gscSubmittedAt}
              onGscMarkSubmitted={handleGscMarkSubmitted}
            />
          </div>
        )}
      </div>
    </>
  );
}
