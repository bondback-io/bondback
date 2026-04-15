import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  adminUpdateSupportTicketStatus,
  listSupportTicketMessagesForViewer,
  loadSupportTicketForViewer,
  submitSupportTicketReply,
} from "@/lib/actions/support-thread";
import { ticketDisplayId } from "@/lib/actions/support";

export const dynamic = "force-dynamic";

export default async function AdminSupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) redirect("/");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!(profile as { is_admin?: boolean | null } | null)?.is_admin) redirect("/dashboard");

  const { id } = await params;
  const { ticket, isAdmin } = await loadSupportTicketForViewer(id);
  if (!ticket || !isAdmin) notFound();

  const messages = await listSupportTicketMessagesForViewer(id);
  const isClosed = ticket.status === "closed" || ticket.status === "completed";

  return (
    <AdminShell activeHref="/admin/support">
      <section className="space-y-4">
        <Link
          href="/admin/support"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to tickets
        </Link>

        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg font-semibold dark:text-gray-100">
                {ticket.subject}
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {ticket.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              {ticketDisplayId(ticket.id)} • Created {format(new Date(ticket.created_at), "dd MMM yyyy, HH:mm")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p className="text-muted-foreground dark:text-gray-400">
                <span className="font-medium text-foreground dark:text-gray-100">User:</span> {ticket.user_id}
              </p>
              <p className="text-muted-foreground dark:text-gray-400">
                <span className="font-medium text-foreground dark:text-gray-100">Contact email:</span>{" "}
                {ticket.email || "—"}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
              {ticket.description}
            </div>

            <form action={adminUpdateSupportTicketStatus} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="ticketId" value={ticket.id} />
              {(["open", "in_progress", "completed", "closed"] as const).map((st) => (
                <Button key={st} type="submit" name="status" value={st} variant={ticket.status === st ? "default" : "outline"} size="sm">
                  {st}
                </Button>
              ))}
            </form>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground dark:text-gray-100">Conversation</h3>
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground dark:text-gray-400">No replies yet.</p>
              ) : (
                <ul className="space-y-2">
                  {messages.map((m) => {
                    const from =
                      m.author_role === "admin"
                        ? "Admin"
                        : m.author_role === "user"
                          ? "User"
                          : m.author_role === "email"
                            ? m.email_from || "Inbound email"
                            : "System";
                    return (
                      <li key={m.id} className="rounded-md border border-border bg-card px-3 py-2 dark:border-gray-700 dark:bg-gray-900/60">
                        <p className="text-[11px] text-muted-foreground dark:text-gray-400">
                          {from} • {format(new Date(m.created_at), "dd MMM yyyy, HH:mm")}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground dark:text-gray-100">{m.body}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <form action={submitSupportTicketReply} className="space-y-2">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Textarea
                name="body"
                minLength={3}
                required
                disabled={isClosed}
                rows={4}
                placeholder={isClosed ? "Ticket is closed." : "Reply to user (this sends an email and logs here)..."}
                className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              />
              <Button type="submit" disabled={isClosed}>
                {isClosed ? "Ticket closed" : "Send reply to user"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </AdminShell>
  );
}
