import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SerializableDisputeMessage } from "@/lib/disputes/serialize-dispute-messages";

function roleBadgeClass(role: string): string {
  const r = role.toLowerCase();
  if (r === "admin") return "border-violet-500/50 bg-violet-600 text-white";
  if (r === "system") return "border-slate-500/50 bg-slate-600 text-white";
  if (r === "lister") return "border-sky-500/50 bg-sky-700 text-white";
  if (r === "cleaner") return "border-emerald-500/50 bg-emerald-700 text-white";
  return "border-border bg-muted text-foreground dark:bg-gray-800 dark:text-gray-100";
}

/**
 * Read-only chronological audit of `dispute_messages` (opens, responses, counters, admin mediation, payment notes).
 */
export function DisputeAuditTimeline({
  jobId,
  messages,
  /** When true (admin console), show visibility badges for admin-authored rows. */
  isAdminConsole = false,
}: {
  jobId: number;
  messages: SerializableDisputeMessage[];
  isAdminConsole?: boolean;
}) {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <Card className="border-border dark:border-gray-800 dark:bg-gray-900/50">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Activity &amp; audit trail</CardTitle>
        <p className="text-xs text-muted-foreground dark:text-gray-400">
          Job #{jobId} — messages and actions in time order (counters, uploads, mediation, payment requests).
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            No activity logged yet. New disputes and replies appear here automatically.
          </p>
        ) : (
          <ul className="relative space-y-4 border-l-2 border-amber-200/80 pl-4 dark:border-amber-900/60">
            {sorted.map((m) => {
              const isAdminAuthor = m.author_role.toLowerCase() === "admin";
              const vL = m.visible_to_lister === true;
              const vC = m.visible_to_cleaner === true;
              const internalOnly = isAdminAuthor && !vL && !vC;
              return (
              <li key={m.id || `${m.created_at}-${m.body.slice(0, 24)}`} className="relative">
                <span
                  className="absolute -left-[21px] top-2 h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-background dark:bg-amber-400 dark:ring-gray-950"
                  aria-hidden
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`text-[10px] uppercase tracking-wide ${roleBadgeClass(m.author_role)}`}>
                    {m.author_role}
                  </Badge>
                  <span className="text-[11px] tabular-nums text-muted-foreground dark:text-gray-500">
                    {m.created_at ? new Date(m.created_at).toLocaleString() : "—"}
                  </span>
                  {m.is_escalation_event ? (
                    <Badge variant="outline" className="text-[10px] dark:border-amber-700 dark:text-amber-200">
                      Escalation
                    </Badge>
                  ) : null}
                  {isAdminConsole && isAdminAuthor ? (
                    internalOnly ? (
                      <Badge variant="outline" className="text-[10px] border-slate-500 text-slate-700 dark:border-slate-600 dark:text-slate-300">
                        Internal — not on party timeline
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-sky-600/50 text-sky-800 dark:border-sky-700 dark:text-sky-200">
                        Shared: {[vL && "lister", vC && "cleaner"].filter(Boolean).join(" · ") || "—"}
                      </Badge>
                    )
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground dark:text-gray-100">
                  {m.body}
                </p>
                {m.attachment_urls && m.attachment_urls.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {m.attachment_urls.map((url) => (
                      <li
                        key={url}
                        className="h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted dark:border-gray-600"
                      >
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block h-full w-full"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
