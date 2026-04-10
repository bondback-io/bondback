"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, ClipboardCopy, Loader2, Mail, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { sendSeoGscUrlEmail, setSeoGscSubmitted } from "@/lib/actions/seo-gsc";
import { SEO_GSC_TASK_KEY } from "@/lib/seo/seo-gsc-constants";
import { getSiteOriginClient } from "@/lib/site-url-client";
import { cn } from "@/lib/utils";

export type GscUrlEntry = { url: string; selected: boolean };

type Props = {
  regionSlug: string;
  regionName: string;
  pendingUrls: GscUrlEntry[];
  onPendingUrlsChange: (next: GscUrlEntry[]) => void;
  submittedAt: string | null;
  onSubmittedAtChange: (iso: string | null) => void;
  onRefresh: () => void;
};

/** Dedupe by URL; new URLs default to selected. */
export function mergeNewGscUrls(prev: GscUrlEntry[], newUrls: string[]): GscUrlEntry[] {
  const map = new Map(prev.map((e) => [e.url, e.selected]));
  for (const u of newUrls) {
    if (!u.trim()) continue;
    if (!map.has(u)) map.set(u, true);
  }
  return Array.from(map.entries()).map(([url, selected]) => ({ url, selected }));
}

export function SeoGscSubmissionCard({
  regionSlug,
  regionName,
  pendingUrls,
  onPendingUrlsChange,
  submittedAt,
  onSubmittedAtChange,
  onRefresh,
}: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [sitemapSelected, setSitemapSelected] = useState(true);

  const sitemapUrl = useMemo(() => `${getSiteOriginClient()}/sitemap.xml`, []);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      channel = supabase
        .channel(`seo_manual_task_state:${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "seo_manual_task_state",
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            const row = payload.new as { region_slug?: string; task_key?: string } | undefined;
            const oldRow = payload.old as { region_slug?: string; task_key?: string } | undefined;
            const slug = row?.region_slug ?? oldRow?.region_slug;
            const key = row?.task_key ?? oldRow?.task_key;
            if (key === SEO_GSC_TASK_KEY && slug === regionSlug) {
              onRefresh();
            }
          }
        )
        .subscribe();
    };

    void run();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [regionSlug, onRefresh]);

  const toggleUrl = (url: string, selected: boolean) => {
    onPendingUrlsChange(pendingUrls.map((e) => (e.url === url ? { ...e, selected } : e)));
  };

  const selectedForCopy = useMemo(() => {
    const lines: string[] = [];
    if (sitemapSelected) lines.push(sitemapUrl);
    for (const e of pendingUrls) {
      if (e.selected) lines.push(e.url);
    }
    return lines;
  }, [pendingUrls, sitemapSelected, sitemapUrl]);

  const copyForGsc = async () => {
    const text = selectedForCopy.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${selectedForCopy.length} line(s) — paste into URL Inspection or a text file for GSC.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Allow clipboard access or copy manually.",
      });
    }
  };

  const emailList = () => {
    startTransition(async () => {
      const res = await sendSeoGscUrlEmail({
        regionSlug,
        regionName,
        urls: selectedForCopy,
      });
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Email not sent",
          description: "error" in res ? res.error : "Unknown error",
        });
        return;
      }
      toast({ title: "Email sent", description: "Check your inbox for the GSC checklist." });
    });
  };

  const markSubmitted = (completed: boolean) => {
    startTransition(async () => {
      const res = await setSeoGscSubmitted({ regionSlug, completed });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Could not save", description: res.error });
        return;
      }
      onSubmittedAtChange(res.completedAt ?? null);
      toast({ title: completed ? "Marked as submitted" : "Submission cleared" });
    });
  };

  const hasAnyPageUrls = pendingUrls.length > 0;

  return (
    <Card className="border-emerald-200/50 dark:border-emerald-900/40">
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Search className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <CardTitle className="text-lg sm:text-xl">Submit new URLs to Google Search Console</CardTitle>
        </div>
        <CardDescription className="text-sm leading-relaxed">
          New bond-cleaning page URLs (and on-page guide anchors) are collected when you run{" "}
          <strong>Generate SEO</strong>. Include the sitemap URL in your batch when you plan to resubmit it in GSC.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {submittedAt && (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            Last marked submitted: {new Date(submittedAt).toLocaleString()}
          </p>
        )}

        <>
            {!hasAnyPageUrls ? (
              <p className="text-sm text-muted-foreground">
                Run <strong>Generate SEO</strong> for suburbs in this region — URLs will appear here automatically.
              </p>
            ) : null}

            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 dark:border-gray-800">
              <li className="flex gap-3 text-sm">
                <Checkbox
                  id="gsc-sitemap"
                  checked={sitemapSelected}
                  onCheckedChange={(v) => setSitemapSelected(v === true)}
                />
                <Label htmlFor="gsc-sitemap" className="cursor-pointer break-all font-mono text-xs leading-snug">
                  {sitemapUrl}{" "}
                  <span className="font-sans text-muted-foreground">(sitemap — submit in GSC Sitemaps)</span>
                </Label>
              </li>
              {pendingUrls.map((entry) => (
                <li key={entry.url} className="flex gap-3 text-sm">
                  <Checkbox
                    id={`gsc-${entry.url}`}
                    checked={entry.selected}
                    onCheckedChange={(v) => toggleUrl(entry.url, v === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor={`gsc-${entry.url}`} className="cursor-pointer break-all font-mono text-xs leading-snug">
                    {entry.url}
                  </Label>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                disabled={pending || selectedForCopy.length === 0}
                onClick={() => void copyForGsc()}
              >
                <ClipboardCopy className="mr-2 h-4 w-4" aria-hidden />
                Copy URLs for GSC
              </Button>
              <Button type="button" variant="secondary" disabled={pending || selectedForCopy.length === 0} onClick={emailList}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" aria-hidden />}
                Email this list to myself
              </Button>
            </div>

            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-3",
                submittedAt
                  ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                  : "border-border bg-muted/30 dark:border-gray-800"
              )}
            >
              <Checkbox
                id="gsc-mark-submitted"
                checked={!!submittedAt}
                onCheckedChange={(v) => markSubmitted(v === true)}
                disabled={pending}
              />
              <div className="space-y-0.5">
                <Label htmlFor="gsc-mark-submitted" className="cursor-pointer text-sm font-medium">
                  Mark as submitted to Google Search Console
                </Label>
                <p className="text-xs text-muted-foreground">
                  Saves the date in Bond Back so the manual checklist reflects completion (syncs via realtime when enabled).
                </p>
              </div>
            </div>
          </>
      </CardContent>
    </Card>
  );
}
