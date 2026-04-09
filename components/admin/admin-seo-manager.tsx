"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { SEO_CHECKLIST_ITEMS } from "@/lib/seo/seo-checklist-config";
import type { SeoTaskKey } from "@/lib/seo/seo-checklist-config";
import type { SeoAutoCheckResults } from "@/lib/seo/seo-auto-checks";
import { saveSeoManualTask } from "@/lib/actions/seo-manager";
import { cn } from "@/lib/utils";

type ManualMap = Record<string, { completed_at: string | null; notes: string | null }>;

type Props = {
  auto: SeoAutoCheckResults;
  manual: ManualMap;
};

export function AdminSeoManager({ auto, manual }: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [localManual, setLocalManual] = useState(manual);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const def of SEO_CHECKLIST_ITEMS) {
      if (!def.allowAuto) {
        o[def.key] = manual[def.key]?.notes ?? "";
      }
    }
    return o;
  });

  const { progressPct, doneCount, totalCount } = useMemo(() => {
    let done = 0;
    const total = SEO_CHECKLIST_ITEMS.length;
    for (const def of SEO_CHECKLIST_ITEMS) {
      if (def.allowAuto) {
        if (auto[def.key]?.ok) done += 1;
      } else if (localManual[def.key]?.completed_at) {
        done += 1;
      }
    }
    return {
      progressPct: total ? Math.round((done / total) * 100) : 0,
      doneCount: done,
      totalCount: total,
    };
  }, [auto, localManual]);

  const persistManual = (taskKey: SeoTaskKey, completed: boolean, notes: string) => {
    startTransition(async () => {
      const res = await saveSeoManualTask({ taskKey, completed, notes });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Could not save", description: res.error });
        return;
      }
      setLocalManual((prev) => ({
        ...prev,
        [taskKey]: {
          completed_at: completed ? new Date().toISOString() : null,
          notes: notes.trim() ? notes.trim() : null,
        },
      }));
      toast({ title: "Saved" });
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-background dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-gray-950">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <CardTitle className="text-xl">SEO progress</CardTitle>
            <Badge variant="secondary" className="font-mono">
              {doneCount}/{totalCount}
            </Badge>
          </div>
          <CardDescription>
            Auto checks cover on-site technical SEO; off-site and CWV need manual confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={progressPct} className="h-3" />
          <p className="text-sm text-muted-foreground">{progressPct}% complete</p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {SEO_CHECKLIST_ITEMS.map((def) => {
          const k = def.key;
          const autoRow = auto[k];
          const man = localManual[k];
          const manualOnly = !def.allowAuto;
          const satisfied = manualOnly ? !!man?.completed_at : !!autoRow?.ok;

          return (
            <Card
              key={k}
              className={cn(
                "overflow-hidden",
                satisfied && "border-emerald-200/90 dark:border-emerald-900/60"
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {satisfied ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <CardTitle className="text-base leading-snug">{def.label}</CardTitle>
                    <p className="text-sm text-muted-foreground">{autoRow?.detail}</p>
                    {manualOnly && man?.completed_at && (
                      <p className="text-xs text-muted-foreground">
                        Completed {new Date(man.completed_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!manualOnly && (
                      <Badge variant={autoRow?.ok ? "default" : "secondary"}>
                        {autoRow?.ok ? "Auto: pass" : "Auto: review"}
                      </Badge>
                    )}
                    {manualOnly && (
                      <Button
                        type="button"
                        size="sm"
                        variant={man?.completed_at ? "outline" : "default"}
                        disabled={pending}
                        onClick={() =>
                          persistManual(k, !man?.completed_at, draftNotes[k] ?? "")
                        }
                      >
                        {pending ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : man?.completed_at ? (
                          "Mark incomplete"
                        ) : (
                          "Mark complete"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              {manualOnly && (
                <CardContent className="space-y-3 border-t border-border/60 pt-4 dark:border-gray-800">
                  <div className="space-y-2">
                    <Label htmlFor={`notes-${k}`} className="text-xs font-medium">
                      Notes (optional)
                    </Label>
                    <Textarea
                      id={`notes-${k}`}
                      rows={2}
                      placeholder="URLs, dates, tool screenshots…"
                      value={draftNotes[k] ?? ""}
                      onChange={(e) =>
                        setDraftNotes((prev) => ({ ...prev, [k]: e.target.value }))
                      }
                      className="text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      persistManual(k, !!man?.completed_at, draftNotes[k] ?? "")
                    }
                  >
                    Save notes
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
