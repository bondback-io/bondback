import type { ServiceTypeKey } from "@/lib/service-types";

export type UserCalendarEventKind =
  | "preferred"
  | "move_out"
  | "recurring_visit"
  | "recurring_series_start"
  | "contract_resume"
  | "auction_end";

export type UserCalendarEvent = {
  /** Stable id for React keys */
  id: string;
  date: string;
  kind: UserCalendarEventKind;
  serviceType: ServiceTypeKey;
  listingId: string;
  title: string;
  suburb: string;
  postcode: string;
  propertyAddress: string | null;
  listerName: string;
  cleanerName: string | null;
  /** Whole AUD from job when available */
  jobPriceAud: number | null;
  jobId: number | null;
  jobStatus: string | null;
  occurrenceId: string | null;
  occurrenceStatus: string | null;
  /** True when the signed-in user is the lister for this listing */
  userIsListerForListing: boolean;
  /** Lister may reschedule/skip this occurrence (no job attached yet) */
  canRescheduleOccurrence: boolean;
  /** Lister may edit preferred / move-out style dates on the listing */
  canEditListingDates: boolean;
};

export type UserCalendarListingHint = {
  listingId: string;
  title: string;
  serviceType: ServiceTypeKey;
  jobId: number | null;
};

export type UserCalendarPayload = {
  events: UserCalendarEvent[];
  /** Lister + active job + missing primary cleaning dates */
  preferredDateHints: UserCalendarListingHint[];
  userHasListerRole: boolean;
  userHasCleanerRole: boolean;
};
