import { redirect } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSupportFilters } from "@/components/admin/admin-support-filters";
import { AdminDeleteSupportTicketButton } from "@/components/admin/admin-delete-support-ticket-button";
import { profileFieldIsAdmin } from "@/lib/is-admin";
import { ticketDisplayId } from "@/lib/support/ticket-format";

type SupportTicketRow = Database["public"]["Tables"]["support_tickets"]["Row"];

export const dynamic = "force-dynamic";

interface AdminSupportPageProps {
  searchParams?: Promise<{
    suggested?: string;
    category?: string;
    status?: string;
    priority?: string;
  }>;
}

export default async function AdminSupportPage({
  searchParams,
}: AdminSupportPageProps) {
  const sp = (await searchParams) ?? {};
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profileData || !profileFieldIsAdmin((profileData as { is_admin?: unknown }).is_admin)) {
    redirect("/dashboard");
  }

  const suggestedFilter = sp.suggested ?? "all";
  const categoryFilter = sp.category ?? "all";
  const statusFilter = sp.status ?? "all";
  const priorityFilter = sp.priority ?? "all";

  let q = supabase
    .from("support_tickets")
    .select("id, user_id, subject, description, category, priority, suggested_category, confidence, ai_reason, status, created_at, last_activity_at")
    .order("last_activity_at", { ascending: false });

  if (suggestedFilter !== "all") {
    q = q.eq("suggested_category", suggestedFilter);
  }
  if (categoryFilter !== "all") {
    q = q.eq("category", categoryFilter);
  }
  if (statusFilter !== "all") {
    q = q.eq("status", statusFilter);
  }
  if (priorityFilter !== "all") {
    q = q.eq("priority", priorityFilter);
  }

  const { data: ticketsData } = await q;
  const tickets = (ticketsData ?? []) as SupportTicketRow[];

  const userIds = [...new Set(tickets.map((t) => t.user_id))];
  const profilesMap = new Map<string, { full_name: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    (profiles ?? []).forEach((p: { id: string; full_name: string | null }) => {
      profilesMap.set(p.id, { full_name: p.full_name });
    });
  }

  return (
    <AdminShell activeHref="/admin/support">
      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-lg font-semibold dark:text-gray-100">
            Support tickets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminSupportFilters
            suggestedFilter={suggestedFilter}
            categoryFilter={categoryFilter}
            statusFilter={statusFilter}
            priorityFilter={priorityFilter}
          />

          <div className="overflow-x-auto rounded-md border border-border dark:border-gray-800">
            <Table>
              <TableHeader>
                <TableRow className="dark:border-gray-800">
                  <TableHead className="dark:text-gray-300">Subject</TableHead>
                  <TableHead className="dark:text-gray-300">Priority</TableHead>
                  <TableHead className="dark:text-gray-300">User</TableHead>
                  <TableHead className="dark:text-gray-300">Final category</TableHead>
                  <TableHead className="dark:text-gray-300">AI suggested</TableHead>
                  <TableHead className="dark:text-gray-300">Status</TableHead>
                  <TableHead className="dark:text-gray-300">Last activity</TableHead>
                  <TableHead className="w-10 text-right dark:text-gray-300" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground dark:text-gray-400">
                      No tickets match the filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  tickets.map((t) => (
                    <TableRow key={t.id} className="dark:border-gray-800">
                      <TableCell className="max-w-[200px] truncate font-medium dark:text-gray-100">
                        <Link href={`/admin/support/${t.id}`} className="hover:underline">
                          {ticketDisplayId(t.id)} · {t.subject}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {(t as any).priority ?? "medium"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground dark:text-gray-400">
                        {profilesMap.get(t.user_id)?.full_name ?? t.user_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {t.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        {t.suggested_category ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className="text-[10px]">
                                {t.suggested_category}
                              </Badge>
                              {t.confidence != null && (
                                <span className="text-[10px] text-muted-foreground dark:text-gray-400">
                                  {Math.round(t.confidence)}%
                                </span>
                              )}
                            </div>
                            {t.ai_reason && (
                              <p className="text-[10px] text-muted-foreground dark:text-gray-500 truncate" title={t.ai_reason}>
                                {t.ai_reason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={t.status === "closed" ? "outline" : "default"}
                          className="text-[10px]"
                        >
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground dark:text-gray-400">
                        {format(new Date((t as any).last_activity_at ?? t.created_at), "dd MMM yyyy, HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <AdminDeleteSupportTicketButton ticketId={String(t.id)} variant="ghost" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
