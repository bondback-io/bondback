/**
 * Aggregates cleaning-related dates for the signed-in user (lister + cleaner views).
 * Uses service role when available so RLS does not hide linked rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeServiceType, type ServiceTypeKey } from "@/lib/service-types";
import { isJobCancelledStatus } from "@/lib/jobs/job-status-helpers";
import type {
  UserCalendarEvent,
  UserCalendarListingHint,
  UserCalendarPayload,
} from "@/lib/calendar/user-calendar-types";

function ymd(d: string | Date): string {
  if (typeof d === "string") {
    const s = d.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "";
  return x.toISOString().slice(0, 10);
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

async function loadProfileNames(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  ids: string[]
): Promise<Record<string, string>> {
  const clean = uniq(ids.map((x) => x.trim()).filter(Boolean));
  if (clean.length === 0) return {};
  const { data } = await admin.from("profiles").select("id, full_name").in("id", clean);
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const r = row as { id: string; full_name: string | null };
    out[r.id] = r.full_name?.trim() || "Lister";
  }
  return out;
}

function listingMissingPrimaryDates(row: {
  service_type: string | null;
  preferred_dates: unknown;
  move_out_date: string | null;
  recurring_series_start_date: string | null;
}): boolean {
  const hasPref = Array.isArray(row.preferred_dates) && row.preferred_dates.length > 0;
  const hasMove = Boolean(row.move_out_date?.trim());
  const hasSeries = Boolean(row.recurring_series_start_date?.trim());
  if (normalizeServiceType(row.service_type) === "recurring_house_cleaning") {
    return !hasSeries && !hasMove;
  }
  return !hasPref && !hasMove;
}

export async function fetchUserCalendarPayload(userId: string): Promise<UserCalendarPayload> {
  const supabase = await createServerSupabaseClient();
  const { data: prof } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", userId)
    .maybeSingle();
  const roles = (prof as { roles?: string[] | null } | null)?.roles ?? [];
  const userHasListerRole = roles.includes("lister");
  const userHasCleanerRole = roles.includes("cleaner");

  const admin = createSupabaseAdminClient();
  const client = (admin ?? supabase) as SupabaseClient<Database>;

  const events: UserCalendarEvent[] = [];
  const preferredDateHints: UserCalendarListingHint[] = [];

  const { data: jobs } = await client
    .from("jobs")
    .select(
      "id, listing_id, status, agreed_amount_cents, lister_id, winner_id, recurring_occurrence_id, created_at"
    )
    .or(`lister_id.eq.${userId},winner_id.eq.${userId}`);

  const jobRows =
    (jobs ?? []) as {
      id: number;
      listing_id: string | number;
      status: string;
      agreed_amount_cents: number | null;
      lister_id: string;
      winner_id: string | null;
      recurring_occurrence_id: string | null;
      created_at: string;
    }[];

  const listingIdsFromJobs = uniq(
    jobRows.map((j) => String(j.listing_id)).filter((x) => x.length > 0)
  );

  let ownedListingIds: string[] = [];
  if (userHasListerRole) {
    const { data: owned } = await client
      .from("listings")
      .select("id")
      .eq("lister_id", userId)
      .in("status", ["live", "ended"]);
    ownedListingIds = uniq((owned ?? []).map((r) => String((r as { id: string | number }).id)));
  }

  const allListingIds = uniq([...listingIdsFromJobs, ...ownedListingIds]);
  if (allListingIds.length === 0) {
    return { events, preferredDateHints, userHasListerRole, userHasCleanerRole };
  }

  const { data: listings } = await client
    .from("listings")
    .select(
      "id, lister_id, title, suburb, postcode, property_address, service_type, preferred_dates, move_out_date, recurring_series_start_date, end_time, status"
    )
    .in("id", allListingIds as never);

  const listingMap = new Map<
    string,
    {
      id: string;
      lister_id: string;
      title: string;
      suburb: string;
      postcode: string;
      property_address: string | null;
      service_type: string;
      preferred_dates: string[] | null;
      move_out_date: string | null;
      recurring_series_start_date: string | null;
      end_time: string | null;
      status: string;
    }
  >();

  for (const raw of listings ?? []) {
    const L = raw as Record<string, unknown>;
    const id = String(L.id ?? "");
    if (!id) continue;
    listingMap.set(id, {
      id,
      lister_id: String(L.lister_id ?? ""),
      title: String(L.title ?? "Listing"),
      suburb: String(L.suburb ?? ""),
      postcode: String(L.postcode ?? ""),
      property_address: (L.property_address as string | null) ?? null,
      service_type: String(L.service_type ?? "bond_cleaning"),
      preferred_dates: (L.preferred_dates as string[] | null) ?? null,
      move_out_date: (L.move_out_date as string | null) ?? null,
      recurring_series_start_date: (L.recurring_series_start_date as string | null) ?? null,
      end_time: (L.end_time as string | null) ?? null,
      status: String(L.status ?? ""),
    });
  }

  const profileIds = uniq([
    ...[...listingMap.values()].map((l) => l.lister_id),
    ...jobRows.map((j) => j.winner_id).filter((x): x is string => Boolean(x)),
  ]);
  const names = admin ? await loadProfileNames(admin, profileIds) : {};

  const jobsByListing = new Map<string, typeof jobRows>();
  for (const j of jobRows) {
    const lid = String(j.listing_id);
    const arr = jobsByListing.get(lid) ?? [];
    arr.push(j);
    jobsByListing.set(lid, arr);
  }

  const pushEvent = (e: Omit<UserCalendarEvent, "id"> & { id?: string }) => {
    const id =
      e.id ??
      `${e.kind}-${e.listingId}-${e.date}-${e.jobId ?? "nj"}-${e.occurrenceId ?? "no"}`;
    events.push({ ...e, id });
  };

  for (const listing of listingMap.values()) {
    const st = normalizeServiceType(listing.service_type) as ServiceTypeKey;
    const jlist = jobsByListing.get(listing.id) ?? [];
    const primaryJob =
      jlist.find((j) => !isJobCancelledStatus(j.status) && String(j.status).toLowerCase() !== "completed") ??
      jlist[0] ??
      null;

    const listerName = names[listing.lister_id] ?? "Lister";
    const cleanerName = primaryJob?.winner_id ? names[primaryJob.winner_id] ?? null : null;
    const userIsLister = listing.lister_id === userId;
    const jobPriceAud =
      primaryJob?.agreed_amount_cents != null && primaryJob.agreed_amount_cents > 0
        ? Math.round(primaryJob.agreed_amount_cents / 100)
        : null;

    const jobAllowsEdit =
      primaryJob != null &&
      !isJobCancelledStatus(primaryJob.status) &&
      String(primaryJob.status).toLowerCase() !== "completed";

    const canEditListingDates = userHasListerRole && userIsLister && jobAllowsEdit;

    if (Array.isArray(listing.preferred_dates)) {
      for (const rawD of listing.preferred_dates) {
        const d = ymd(rawD);
        if (!d) continue;
        pushEvent({
          date: d,
          kind: "preferred",
          serviceType: st,
          listingId: listing.id,
          title: listing.title,
          suburb: listing.suburb,
          postcode: listing.postcode,
          propertyAddress: listing.property_address,
          listerName,
          cleanerName,
          jobPriceAud,
          jobId: primaryJob?.id ?? null,
          jobStatus: primaryJob?.status ?? null,
          occurrenceId: null,
          occurrenceStatus: null,
          userIsListerForListing: userIsLister,
          canRescheduleOccurrence: false,
          canEditListingDates,
        });
      }
    }

    if (listing.move_out_date?.trim()) {
      const d = ymd(listing.move_out_date);
      if (d) {
        pushEvent({
          date: d,
          kind: "move_out",
          serviceType: st,
          listingId: listing.id,
          title: listing.title,
          suburb: listing.suburb,
          postcode: listing.postcode,
          propertyAddress: listing.property_address,
          listerName,
          cleanerName,
          jobPriceAud,
          jobId: primaryJob?.id ?? null,
          jobStatus: primaryJob?.status ?? null,
          occurrenceId: null,
          occurrenceStatus: null,
          userIsListerForListing: userIsLister,
          canRescheduleOccurrence: false,
          canEditListingDates,
        });
      }
    }

    if (listing.recurring_series_start_date?.trim()) {
      const d = ymd(listing.recurring_series_start_date);
      if (d) {
        pushEvent({
          date: d,
          kind: "recurring_series_start",
          serviceType: st,
          listingId: listing.id,
          title: listing.title,
          suburb: listing.suburb,
          postcode: listing.postcode,
          propertyAddress: listing.property_address,
          listerName,
          cleanerName,
          jobPriceAud,
          jobId: primaryJob?.id ?? null,
          jobStatus: primaryJob?.status ?? null,
          occurrenceId: null,
          occurrenceStatus: null,
          userIsListerForListing: userIsLister,
          canRescheduleOccurrence: false,
          canEditListingDates,
        });
      }
    }

    if (listing.end_time?.trim()) {
      const d = ymd(listing.end_time);
      if (d) {
        pushEvent({
          date: d,
          kind: "auction_end",
          serviceType: st,
          listingId: listing.id,
          title: listing.title,
          suburb: listing.suburb,
          postcode: listing.postcode,
          propertyAddress: listing.property_address,
          listerName,
          cleanerName,
          jobPriceAud,
          jobId: primaryJob?.id ?? null,
          jobStatus: primaryJob?.status ?? null,
          occurrenceId: null,
          occurrenceStatus: null,
          userIsListerForListing: userIsLister,
          canRescheduleOccurrence: false,
          canEditListingDates: false,
        });
      }
    }

    const hasPipelineJob = jlist.some(
      (j) => !isJobCancelledStatus(j.status) && String(j.status).toLowerCase() !== "completed"
    );
    if (userHasListerRole && userIsLister && hasPipelineJob && listingMissingPrimaryDates(listing)) {
      preferredDateHints.push({
        listingId: listing.id,
        title: listing.title,
        serviceType: st,
        jobId: primaryJob?.id ?? null,
      });
    }
  }

  if (allListingIds.length > 0) {
    const { data: contracts } = await client
      .from("recurring_contracts")
      .select("id, listing_id, resume_scheduled_for, paused_at")
      .in("listing_id", allListingIds as never);

    const contractRows =
      (contracts ?? []) as {
        id: string;
        listing_id: string;
        resume_scheduled_for: string | null;
        paused_at: string | null;
      }[];

    for (const c of contractRows) {
      if (c.resume_scheduled_for?.trim() && !c.paused_at) {
        const d = ymd(c.resume_scheduled_for);
        const listing = listingMap.get(String(c.listing_id));
        if (d && listing) {
          const st = normalizeServiceType(listing.service_type) as ServiceTypeKey;
          const jlist = jobsByListing.get(listing.id) ?? [];
          const primaryJob = jlist[0] ?? null;
          pushEvent({
            date: d,
            kind: "contract_resume",
            serviceType: st,
            listingId: listing.id,
            title: listing.title,
            suburb: listing.suburb,
            postcode: listing.postcode,
            propertyAddress: listing.property_address,
            listerName: names[listing.lister_id] ?? "Lister",
            cleanerName: primaryJob?.winner_id ? names[primaryJob.winner_id] ?? null : null,
            jobPriceAud:
              primaryJob?.agreed_amount_cents != null && primaryJob.agreed_amount_cents > 0
                ? Math.round(primaryJob.agreed_amount_cents / 100)
                : null,
            jobId: primaryJob?.id ?? null,
            jobStatus: primaryJob?.status ?? null,
            occurrenceId: null,
            occurrenceStatus: null,
            userIsListerForListing: listing.lister_id === userId,
            canRescheduleOccurrence: false,
            canEditListingDates: false,
          });
        }
      }
    }

    const contractIds = contractRows.map((c) => c.id);
    if (contractIds.length > 0) {
      const { data: occs } = await client
        .from("recurring_occurrences")
        .select("id, contract_id, scheduled_date, status, job_id")
        .in("contract_id", contractIds as never)
        .order("scheduled_date", { ascending: true });

      const contractListing = new Map<string, string>();
      for (const c of contractRows) {
        contractListing.set(c.id, String(c.listing_id));
      }

      for (const o of (occs ?? []) as {
        id: string;
        contract_id: string;
        scheduled_date: string;
        status: string;
        job_id: number | null;
      }[]) {
        const lid = contractListing.get(o.contract_id);
        if (!lid) continue;
        const listing = listingMap.get(lid);
        if (!listing) continue;
        const d = ymd(o.scheduled_date);
        if (!d) continue;
        const st = normalizeServiceType(listing.service_type) as ServiceTypeKey;
        const jlist = jobsByListing.get(listing.id) ?? [];
        const jobForOcc = o.job_id != null ? jlist.find((j) => j.id === o.job_id) : null;
        const primaryJob = jobForOcc ?? jlist[0] ?? null;
        const userIsLister = listing.lister_id === userId;
        const jobAllowsEdit =
          primaryJob != null &&
          !isJobCancelledStatus(primaryJob.status) &&
          String(primaryJob.status).toLowerCase() !== "completed";

        const occContract = contractRows.find((x) => x.id === o.contract_id);
        const canRescheduleOccurrence =
          userHasListerRole &&
          userIsLister &&
          o.status === "scheduled" &&
          o.job_id == null &&
          !occContract?.paused_at;

        pushEvent({
          date: d,
          kind: "recurring_visit",
          serviceType: st,
          listingId: listing.id,
          title: listing.title,
          suburb: listing.suburb,
          postcode: listing.postcode,
          propertyAddress: listing.property_address,
          listerName: names[listing.lister_id] ?? "Lister",
          cleanerName: primaryJob?.winner_id ? names[primaryJob.winner_id] ?? null : null,
          jobPriceAud:
            primaryJob?.agreed_amount_cents != null && primaryJob.agreed_amount_cents > 0
              ? Math.round(primaryJob.agreed_amount_cents / 100)
              : null,
          jobId: o.job_id ?? primaryJob?.id ?? null,
          jobStatus: primaryJob?.status ?? null,
          occurrenceId: o.id,
          occurrenceStatus: o.status,
          userIsListerForListing: userIsLister,
          canRescheduleOccurrence,
          canEditListingDates: userHasListerRole && userIsLister && jobAllowsEdit,
        });
      }
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));

  return { events, preferredDateHints, userHasListerRole, userHasCleanerRole };
}
