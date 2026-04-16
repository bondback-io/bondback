import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { SupportForm } from "@/components/support/support-form";
import { getSupportContactEmail } from "@/lib/support-contact-email";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listMySupportTickets } from "@/lib/actions/support-thread";
import { ticketDisplayId } from "@/lib/support/ticket-format";

type SupportPageProps = {
  searchParams?: Promise<{ jobId?: string; listingId?: string }>;
};

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const session = await getSessionWithProfile();
  if (!session) {
    redirect("/login?redirectTo=/support");
  }

  const params = await searchParams;
  const jobId = params?.jobId ?? "";
  const listingId = params?.listingId ?? "";
  const initialEmail = session.user.email ?? "";
  const supportContactEmail = getSupportContactEmail();
  const tickets = await listMySupportTickets();

  return (
    <section className="page-inner space-y-6">
      <Link
        href="/help"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Help
      </Link>
      <SupportForm
        initialEmail={initialEmail}
        initialJobId={jobId}
        initialListingId={listingId}
      />
      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base font-semibold dark:text-gray-100">Your support tickets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              You don&apos;t have any support tickets yet. Need help? Create a new ticket.
            </p>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/support/${t.id}`}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 hover:bg-muted/50 dark:border-gray-700 dark:bg-gray-800/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground dark:text-gray-100">
                        {ticketDisplayId(t.id)} · {t.subject}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        {format(new Date(t.created_at), "dd MMM yyyy, HH:mm")}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {((t as any).priority ?? "medium").toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {t.status}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground dark:text-gray-500">
        You can also email{" "}
        <a
          href={`mailto:${supportContactEmail}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {supportContactEmail}
        </a>
        .
      </p>
    </section>
  );
}
