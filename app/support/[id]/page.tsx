import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  listSupportTicketMessagesForViewer,
  loadSupportTicketForViewer,
  submitSupportTicketReply,
} from "@/lib/actions/support-thread";
import { ticketDisplayId } from "@/lib/support/ticket-format";

export const dynamic = "force-dynamic";

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/login?redirectTo=/support");

  const { id } = await params;
  const { ticket } = await loadSupportTicketForViewer(id);
  if (!ticket) notFound();
  const messages = await listSupportTicketMessagesForViewer(id);
  const isClosed = ticket.status === "closed" || ticket.status === "completed";

  return (
    <section className="page-inner mx-auto max-w-3xl space-y-4">
      <Link
        href="/support"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to support
      </Link>

      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl font-semibold tracking-tight dark:text-gray-100">
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
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
            {ticket.description}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground dark:text-gray-100">Conversation</h3>
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground dark:text-gray-400">No replies yet.</p>
            ) : (
              <ul className="space-y-2">
                {messages.map((m) => {
                  const from =
                    m.author_role === "admin"
                      ? "Support"
                      : m.author_role === "user"
                        ? "You"
                        : m.author_role === "email"
                          ? m.email_from || "Email"
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
              placeholder={isClosed ? "Ticket is closed." : "Reply to support..."}
              className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
            <Button type="submit" disabled={isClosed}>
              {isClosed ? "Ticket closed" : "Send reply"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
