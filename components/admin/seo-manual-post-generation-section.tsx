"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const SEO_MANUAL_TASKS: { id: string; label: string }[] = [
  {
    id: "gsc-sitemap",
    label: "Submit / update sitemap in Google Search Console (sitemap.xml)",
  },
  {
    id: "gsc-urls",
    label: "Use URL Inspection to request indexing for new bond-cleaning URLs",
  },
  {
    id: "bing",
    label: "Submit sitemap in Bing Webmaster Tools",
  },
  {
    id: "truelocal",
    label: "Create or refresh Bond Back listings on TrueLocal (and similar AU directories)",
  },
  {
    id: "oneflare",
    label: "Ensure OneFlare / service directory profiles link back to canonical pages",
  },
  {
    id: "internal-links",
    label: "Add internal links from homepage and related location pages to new slugs",
  },
  {
    id: "social",
    label: "Share new location pages on social / community channels where allowed",
  },
];

function storageKey(regionSlug: string) {
  return `bondback_seo_manual_tasks_${regionSlug}`;
}

type Props = {
  regionSlug: string;
  regionName: string;
  /** When set, the "URL Inspection" manual task shows complete (Supabase). */
  gscSubmittedAt?: string | null;
  /** Toggle GSC URL task from the checklist (same as GSC card). */
  onGscMarkSubmitted?: (completed: boolean) => void;
  /** When true, card title is "Additional manual tasks" (use under a shared "Manual actions" heading). */
  embedded?: boolean;
};

const GSC_URLS_TASK_ID = "gsc-urls";

export function SeoManualPostGenerationSection({
  regionSlug,
  regionName,
  gscSubmittedAt = null,
  onGscMarkSubmitted,
  embedded = false,
}: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(regionSlug));
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        const copy =
          typeof parsed === "object" && parsed ? { ...parsed } : {};
        delete copy[GSC_URLS_TASK_ID];
        setChecked(copy);
      } else {
        setChecked({});
      }
    } catch {
      setChecked({});
    }
  }, [regionSlug]);

  const persist = useCallback(
    (next: Record<string, boolean>) => {
      const forStorage = { ...next };
      delete forStorage[GSC_URLS_TASK_ID];
      setChecked(next);
      try {
        localStorage.setItem(storageKey(regionSlug), JSON.stringify(forStorage));
      } catch {
        /* ignore quota */
      }
    },
    [regionSlug]
  );

  const toggle = (id: string, value: boolean) => {
    if (id === GSC_URLS_TASK_ID && onGscMarkSubmitted) {
      onGscMarkSubmitted(value);
      return;
    }
    persist({ ...checked, [id]: value });
  };

  const gscUrlsDone = !!gscSubmittedAt;

  const emailBody = useMemo(() => {
    const effective = (id: string) =>
      id === GSC_URLS_TASK_ID ? gscUrlsDone : !!checked[id];
    const lines = [
      `Manual SEO follow-up — ${regionName}`,
      "",
      "Outstanding tasks:",
      ...SEO_MANUAL_TASKS.filter((t) => !effective(t.id)).map((t) => `☐ ${t.label}`),
      "",
      "Completed:",
      ...SEO_MANUAL_TASKS.filter((t) => effective(t.id)).map((t) => `☑ ${t.label}`),
    ];
    return lines.join("\n");
  }, [checked, regionName, gscUrlsDone]);

  const emailSubject = useMemo(
    () => encodeURIComponent(`SEO manual actions — ${regionName}`),
    [regionName]
  );

  const mailtoHref = useMemo(() => {
    const body = encodeURIComponent(emailBody);
    return `mailto:?subject=${emailSubject}&body=${body}`;
  }, [emailBody, emailSubject]);

  return (
    <Card className="border-border/80 dark:border-gray-800">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg sm:text-xl">
          {embedded ? "Additional manual tasks" : "Manual actions required"}
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          {embedded
            ? "Other post-generation steps. The GSC URL list is tracked above."
            : "Post-generation work that cannot be automated. Tracked per region on this device."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {SEO_MANUAL_TASKS.map((task) => {
            const isGscUrls = task.id === GSC_URLS_TASK_ID;
            const isChecked = isGscUrls ? gscUrlsDone : !!checked[task.id];
            return (
            <li
              key={task.id}
              className={cn(
                "flex gap-3 rounded-lg border border-transparent px-1 py-0.5 transition-colors",
                isChecked && "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
              )}
            >
              <Checkbox
                id={`manual-${regionSlug}-${task.id}`}
                checked={isChecked}
                onCheckedChange={(v) => toggle(task.id, v === true)}
                disabled={isGscUrls && !onGscMarkSubmitted}
                className="mt-0.5"
              />
              <Label
                htmlFor={`manual-${regionSlug}-${task.id}`}
                className="cursor-pointer text-sm font-normal leading-snug text-foreground"
              >
                {task.label}
              </Label>
            </li>
          );
          })}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" variant="secondary" className="w-full sm:w-auto" asChild>
            <a href={mailtoHref}>
              <Mail className="mr-2 h-4 w-4" aria-hidden />
              Email me this list
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Opens your mail app with subject and checklist (completed vs outstanding).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
