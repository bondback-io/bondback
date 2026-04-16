import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import {
  createSupabaseAdminClient,
  emailsMapFromAuthUsers,
  lastSignInMapFromAuthUsers,
  listAllAuthUsersPaginated,
  mergeProfilesWithAuthUsers,
} from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminUsersFetchErrorToast } from "@/components/admin/admin-users-fetch-error-toast";
import { AdminUserActions } from "@/components/admin/admin-user-actions";
import { AdminUsersFilters } from "@/components/admin/admin-users-filters";
import { AdminUserVerificationActions } from "@/components/admin/admin-user-verification-actions";
import { VerificationBadges } from "@/components/shared/verification-badges";
import { PROFILE_ADMIN_TABLE_SELECT } from "@/lib/supabase/queries";
import { adminJobGrossCents } from "@/lib/admin-job-gross";
import { effectiveProfilePhotoUrl } from "@/lib/profile-display-photo";
import { calculateProfileStrengthPercent } from "@/lib/profile-strength";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type JobRow = {
  id: number;
  lister_id: string;
  winner_id: string | null;
  listing_id: string;
  status: string;
  agreed_amount_cents?: number | null;
};
type ListingRow = { id: string; current_lowest_bid_cents: number | null };

interface AdminUsersPageProps {
  searchParams?: Promise<{
    q?: string;
    role?: string;
    sort?: string;
    banned?: string;
    show_deleted?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params =
    (await (searchParams ?? Promise.resolve({}))) as NonNullable<
      Awaited<AdminUsersPageProps["searchParams"]>
    >;
  const supabase = await createServerSupabaseClient();
  /** Service-role client (SUPABASE_SERVICE_ROLE_KEY) — required to load all profiles and bypass RLS. */
  const supabaseAdmin = createSupabaseAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = supabaseAdmin
    ? await supabaseAdmin
        .from("profiles")
        .select("id, is_admin")
        .eq("id", user.id)
        .maybeSingle()
    : await supabase
        .from("profiles")
        .select("id, is_admin")
        .eq("id", user.id)
        .maybeSingle();

  if (!profile || !(profile as { is_admin?: boolean }).is_admin) {
    redirect("/dashboard");
  }

  // Admin Users requires the service-role client to bypass RLS and load all users.
  const serviceRoleMissing = !supabaseAdmin;

  const [profilesRes, jobsRes, authUsers] = await Promise.all([
    serviceRoleMissing
      ? { data: null as ProfileRow[] | null, error: { message: "Service role key not configured" } }
      : supabaseAdmin!
          .from("profiles")
          .select("*")
          .order("id", { ascending: false }),
    serviceRoleMissing
      ? { data: [] as JobRow[], error: null }
      : supabaseAdmin!.from("jobs").select("id, lister_id, winner_id, listing_id, status, agreed_amount_cents"),
    serviceRoleMissing || !supabaseAdmin
      ? Promise.resolve([] as User[])
      : listAllAuthUsersPaginated(supabaseAdmin),
  ]);

  const emailsMap = emailsMapFromAuthUsers(authUsers);
  const lastSignInMap = lastSignInMapFromAuthUsers(authUsers);

  if (process.env.NODE_ENV !== "production") {
     
    console.log("[AdminUsersPage] profiles query", {
      error: profilesRes.error,
      errorCode: (profilesRes.error as { code?: string } | null)?.code,
      count: (profilesRes.data ?? []).length,
      hasAdminClient: !!supabaseAdmin,
      serviceRoleMissing,
    });
  }

  type ProfileWithExtras = ProfileRow & {
    is_admin?: boolean;
    is_banned?: boolean;
    is_deleted?: boolean;
    banned_at?: string | null;
    banned_reason?: string | null;
    banned_by?: string | null;
  };

  let allProfiles = (profilesRes.data ?? []) as ProfileWithExtras[];
  const allJobs = (jobsRes.data ?? []) as JobRow[];

  // Include every Auth user — `profiles` may be missing rows (signup edge cases, manual auth inserts).
  if (!serviceRoleMissing && authUsers.length > 0) {
    allProfiles = mergeProfilesWithAuthUsers(allProfiles, authUsers) as ProfileWithExtras[];
  }

  // When service role is set but list query failed and no auth fallback, show current admin only (full row via service role).
  if (allProfiles.length === 0 && !serviceRoleMissing && profile && supabaseAdmin) {
    const { data: fullAdminRow } = await supabaseAdmin
      .from("profiles")
      .select(PROFILE_ADMIN_TABLE_SELECT)
      .eq("id", user.id)
      .maybeSingle();
    if (fullAdminRow) {
      allProfiles = [fullAdminRow as ProfileWithExtras];
    }
  }

  const listingIds = [...new Set(allJobs.map((j) => j.listing_id))];
  const listingsQuery =
    serviceRoleMissing || listingIds.length === 0
      ? { data: [] as ListingRow[] }
      : await supabaseAdmin!.from("listings").select("id, current_lowest_bid_cents").in("id", listingIds);
  const { data: listingsData } = listingsQuery;
  const listingsMap = new Map<string, ListingRow>();
  (listingsData ?? []).forEach((l: any) => listingsMap.set(l.id, l as ListingRow));

  const totalJobsByUser = new Map<string, number>();
  const totalEarningsByUser = new Map<string, number>();
  for (const j of allJobs) {
    if (j.lister_id) totalJobsByUser.set(j.lister_id, (totalJobsByUser.get(j.lister_id) ?? 0) + 1);
    if (j.winner_id) totalJobsByUser.set(j.winner_id, (totalJobsByUser.get(j.winner_id) ?? 0) + 1);
    if (j.status === "completed" && j.winner_id && j.listing_id) {
      const list = listingsMap.get(j.listing_id);
      const cents = adminJobGrossCents(j, list?.current_lowest_bid_cents);
      totalEarningsByUser.set(j.winner_id, (totalEarningsByUser.get(j.winner_id) ?? 0) + (cents || 0));
    }
  }

  const q = (params.q ?? "").trim().toLowerCase();
  const filterRole = (params.role ?? "").toLowerCase();
  const sort = params.sort ?? "joined_desc";
  const filterBanned = params.banned ?? "";
  const showDeleted = params.show_deleted === "1";

  let filtered = allProfiles.filter((p) => {
    if (!showDeleted && (p as { is_deleted?: boolean }).is_deleted) return false;
    const name = (p.full_name ?? "").toLowerCase();
    const email = (emailsMap.get(p.id) ?? "").toLowerCase();
    const abn = (p.abn ?? "").toLowerCase();
    const matchesQuery =
      q.length === 0 ||
      name.includes(q) ||
      p.id.toLowerCase().includes(q) ||
      email.includes(q) ||
      abn.includes(q);
    const roles = ((p.roles as string[] | null) ?? []) as string[];
    const isAdmin = (p as { is_admin?: boolean }).is_admin;
    const primaryRole = isAdmin ? "admin" : (p.active_role as string | null) ?? roles[0] ?? "lister";
    const matchesRole =
      !filterRole ||
      primaryRole === filterRole ||
      (filterRole === "cleaner" && roles.includes("cleaner")) ||
      (filterRole === "lister" && roles.includes("lister")) ||
      (filterRole === "admin" && isAdmin);
    const isBanned = !!(p as { is_banned?: boolean }).is_banned;
    const matchesBanned =
      filterBanned === "" || (filterBanned === "yes" && isBanned) || (filterBanned === "no" && !isBanned);
    return matchesQuery && matchesRole && matchesBanned;
  });

  filtered = [...filtered].sort((a, b) => {
    if (sort === "name_asc") return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    if (sort === "name_desc") return (b.full_name ?? "").localeCompare(a.full_name ?? "");
    if (sort === "joined_asc" || sort === "joined_desc") {
      const ta = (a as { created_at?: string }).created_at ? new Date((a as { created_at: string }).created_at).getTime() : 0;
      const tb = (b as { created_at?: string }).created_at ? new Date((b as { created_at: string }).created_at).getTime() : 0;
      return sort === "joined_asc" ? ta - tb : tb - ta;
    }
    if (sort === "banned") {
      const ba = (a as { is_banned?: boolean }).is_banned ? 1 : 0;
      const bb = (b as { is_banned?: boolean }).is_banned ? 1 : 0;
      return bb - ba;
    }
    return 0;
  });

  const totalUsers = allProfiles.length;
  const newThisWeek = allProfiles.filter((p) => {
    const created = (p as { created_at?: string }).created_at;
    if (!created) return false;
    return new Date(created) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }).length;

  const fetchErrorToastDescription =
    serviceRoleMissing
      ? "SUPABASE_SERVICE_ROLE_KEY is not set. Add the service_role secret from Supabase → Project Settings → API and restart the dev server."
      : profilesRes.error
        ? (profilesRes.error as { message?: string }).message ?? String(profilesRes.error)
        : null;

  return (
    <AdminShell activeHref="/admin/users">
      <AdminUsersFetchErrorToast
        title={serviceRoleMissing ? "Service role key missing" : "Could not load users"}
        description={fetchErrorToastDescription}
      />
      <div className="space-y-6">
        {(serviceRoleMissing || profilesRes.error) && (
          <Card className="border-destructive/40 bg-destructive/5 text-xs sm:text-sm text-destructive dark:border-red-900/60 dark:bg-red-950/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {serviceRoleMissing ? "Service role key not set" : "Admin users query error"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {serviceRoleMissing ? (
                <p>
                  <code>SUPABASE_SERVICE_ROLE_KEY</code> is not set in your environment. Add it
                  to <code>.env.local</code> (in the BondBack project root) and restart the dev
                  server so the admin panel can load all users and bypass RLS.
                </p>
              ) : (
                <>
                  <p>
                    Unable to load all users from the <code>profiles</code> table. Common causes:
                    wrong key (using <strong>anon</strong> instead of <strong>service_role</strong>)
                    or RLS blocking reads.
                  </p>
                  <p className="mt-1">
                    Use the <strong>service_role</strong> secret from Supabase Dashboard → Project
                    Settings → API (not the anon key). Restart the dev server after changing{" "}
                    <code>.env.local</code>.
                  </p>
                  {profilesRes.error && (
                    <p className="mt-2 rounded bg-black/10 p-2 font-mono text-[11px] dark:bg-white/10">
                      Supabase error: {(profilesRes.error as { message?: string }).message ?? String(profilesRes.error)}
                      {(profilesRes.error as { code?: string }).code && (
                        <> (code: {(profilesRes.error as { code: string }).code})</>
                      )}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
          Users
        </h1>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          View and manage all users. Search by name or email; filter by role and banned status.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              Total users
            </p>
            <p className="text-lg font-semibold dark:text-gray-100">{totalUsers}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              New this week
            </p>
            <p className="text-lg font-semibold dark:text-gray-100">{newThisWeek}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              Showing
            </p>
            <p className="text-lg font-semibold dark:text-gray-100">
              {filtered.length}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                of {totalUsers}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardContent className="p-3">
          <AdminUsersFilters
            initialParams={params}
            totalUsers={totalUsers}
            filteredCount={filtered.length}
          />
        </CardContent>
      </Card>

      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="dark:border-gray-800">
                <TableHead className="w-[52px]">Avatar</TableHead>
                <TableHead className="min-w-[11rem]">Full name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="whitespace-nowrap">Joined</TableHead>
                <TableHead className="hidden md:table-cell whitespace-nowrap">
                  Last login
                </TableHead>
              <TableHead>Badges</TableHead>
                <TableHead className="text-right">Jobs</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Earnings</TableHead>
                <TableHead className="text-center w-16">Profile %</TableHead>
                <TableHead className="w-20">Banned</TableHead>
                <TableHead className="w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => {
                const roles = ((user.roles as string[] | null) ?? []) as string[];
                const isAdmin = (user as { is_admin?: boolean }).is_admin;
                const isBanned = (user as { is_banned?: boolean }).is_banned;
                const isDeleted = (user as { is_deleted?: boolean }).is_deleted;
                const primaryRole: string = isAdmin
                  ? "Admin"
                  : user.active_role === "cleaner"
                    ? "Cleaner"
                    : user.active_role === "lister"
                      ? "Lister"
                      : String(roles[0] ?? "Lister");
                const hasLister = roles.includes("lister");
                const hasCleaner = roles.includes("cleaner");
                const displayRole =
                  isAdmin
                    ? "Admin"
                    : hasLister && hasCleaner
                      ? "Lister + Cleaner"
                      : hasCleaner
                        ? "Cleaner"
                        : "Lister";
                const email = emailsMap.get(user.id) ?? "—";
                const lastSignInAt = lastSignInMap.get(user.id) ?? null;
                const lastLoginLabel = lastSignInAt
                  ? formatDistanceToNow(new Date(lastSignInAt), { addSuffix: true })
                  : "Never";
                const lastLoginAbsolute = lastSignInAt
                  ? format(new Date(lastSignInAt), "MMM d, yyyy · h:mm a")
                  : null;
                const totalJobs = totalJobsByUser.get(user.id) ?? 0;
                const totalEarnings = totalEarningsByUser.get(user.id) ?? 0;
                const strength = calculateProfileStrengthPercent(user);
                const userBadges =
                  (user as { verification_badges?: string[] | null })
                    .verification_badges ?? [];
                const avatarDisplayUrl = effectiveProfilePhotoUrl(user);

                const roleBadge =
                  displayRole === "Admin"
                    ? "bg-slate-600 text-white dark:bg-slate-500"
                    : displayRole === "Cleaner"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                      : displayRole === "Lister + Cleaner"
                        ? "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
                      : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";

                return (
                  <TableRow key={user.id} className="dark:border-gray-800">
                    <TableCell className="w-[52px]">
                      {avatarDisplayUrl ? (
                        <Image
                          src={avatarDisplayUrl}
                          alt=""
                          width={36}
                          height={36}
                          className="rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground dark:bg-gray-800 dark:text-gray-400"
                          aria-hidden
                        >
                          {String(user.full_name ?? "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[11rem] align-top">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="font-medium text-foreground underline-offset-4 hover:underline dark:text-gray-100"
                          >
                            {user.full_name ?? "Unnamed"}
                          </Link>
                          {isDeleted && (
                            <Badge variant="secondary" className="text-[10px]">
                              Deleted
                            </Badge>
                          )}
                        </div>
                        {/* md:hidden: last login lives here on small screens (dedicated column hidden) */}
                        <div
                          className="md:hidden"
                          title={lastLoginAbsolute ?? "No login recorded"}
                        >
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-500">
                            Last login
                          </p>
                          <p className="text-[11px] leading-tight text-muted-foreground whitespace-nowrap dark:text-gray-400">
                            {lastSignInAt ? lastLoginLabel : "Never"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground dark:text-gray-400">
                      {email}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${roleBadge}`}>{displayRole}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground dark:text-gray-400">
                      {user.created_at
                        ? format(new Date(user.created_at), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell
                      className="hidden md:table-cell text-xs text-muted-foreground dark:text-gray-400"
                      title={lastLoginAbsolute ?? undefined}
                    >
                      {lastSignInAt ? (
                        <>
                          <span className="whitespace-nowrap">{lastLoginLabel}</span>
                          <span className="mt-0.5 block text-[10px] text-muted-foreground/90 dark:text-gray-500">
                            {format(new Date(lastSignInAt), "MMM d, yyyy")}
                          </span>
                        </>
                      ) : (
                        <span>Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <VerificationBadges badges={userBadges} showLabel={false} size="sm" />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{totalJobs}</TableCell>
                    <TableCell className="text-right hidden sm:table-cell tabular-nums text-muted-foreground dark:text-gray-400">
                      ${(totalEarnings / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{Math.round(strength)}%</TableCell>
                    <TableCell>
                      {isBanned ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] dark:bg-gray-800">
                          No
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <AdminUserVerificationActions userId={user.id} />
                        <AdminUserActions
                          user={{
                            id: user.id,
                            full_name: user.full_name,
                            email: email !== "—" ? email : null,
                            is_banned: isBanned,
                            is_deleted: isDeleted,
                            roles,
                            active_role: user.active_role,
                            is_admin: isAdmin,
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </AdminShell>
  );
}
