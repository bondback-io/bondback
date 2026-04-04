/**
 * Shared helpers and constants for admin email templates.
 * No "use server" – safe to import from client and server.
 */

/** Notification and transactional types that can have admin templates and per-type toggles. */
export const EMAIL_TEMPLATE_TYPES = [
  "welcome",
  "tutorial_lister",
  "tutorial_cleaner",
  "new_bid",
  "new_message",
  "job_created",
  "job_accepted",
  "job_approved_to_start",
  "job_completed",
  "job_cancelled_by_lister",
  "payment_released",
  "funds_ready",
  "dispute_opened",
  "dispute_resolved",
  "birthday",
] as const;

export type EmailTemplateType = (typeof EMAIL_TEMPLATE_TYPES)[number];

/** Short labels in Admin → Emails (aligned with production template names). */
const LABELS: Record<string, string> = {
  welcome: "Welcome (signup)",
  tutorial_lister: "Lister tutorial",
  tutorial_cleaner: "Cleaner tutorial",
  new_bid: "New bid on your listing",
  new_message: "New message in job chat",
  job_created: "Job created — pay & start",
  job_accepted: "Cleaner: job accepted / go ahead",
  job_approved_to_start: "Cleaner: lister approved — start work",
  job_completed: "Job marked complete — review",
  job_cancelled_by_lister: "Job cancelled by lister",
  payment_released: "Payment released (cleaner)",
  funds_ready: "Funds ready to release (lister)",
  dispute_opened: "Dispute opened",
  dispute_resolved: "Dispute resolved",
  birthday: "Birthday",
};

export function getEmailTypeLabel(type: string): string {
  return LABELS[type] ?? type;
}

/** Sample data for preview and test sends (fake job ID, name, etc.). */
export type SampleData = {
  messageText: string;
  jobId: number | null;
  senderName?: string;
  listingId?: number | null;
};

export const SAMPLE_DATA: Record<string, SampleData> = {
  welcome: {
    messageText: "Welcome to Bond Back — jump into your dashboard to finish setup.",
    jobId: null,
    senderName: "Bond Back",
  },
  tutorial_lister: {
    messageText: "Quick start: create a listing, compare bids, and book your bond clean.",
    jobId: null,
    senderName: "Bond Back",
  },
  tutorial_cleaner: {
    messageText: "Quick start: browse jobs near you, bid or Buy Now, then upload proof and get paid.",
    jobId: null,
    senderName: "Bond Back",
  },
  new_bid: {
    messageText: "I can do this bond clean for $280 — available Saturday or Sunday arvo.",
    jobId: 10042,
    listingId: 10042,
  },
  new_message: {
    messageText: "Hi — would Tuesday 2pm work for access? Happy to shuffle if needed.",
    jobId: 10042,
    senderName: "Alex Smith",
  },
  job_created: {
    messageText: "Your cleaner accepted — pay & start when you’re ready so they get the checklist and address.",
    jobId: 10042,
  },
  job_accepted: {
    messageText: "The lister approved you — you’re clear to start. Check the job for address and checklist.",
    jobId: 10042,
  },
  job_approved_to_start: {
    messageText:
      "Green light from the lister — you can start the bond clean. Open the job for address and checklist.",
    jobId: 10042,
  },
  job_completed: {
    messageText: "The clean’s done and after photos are in — please review and release payment when happy.",
    jobId: 10042,
  },
  job_cancelled_by_lister: {
    messageText: "This listing was cancelled by the lister — you’ve been unassigned. Browse other jobs anytime.",
    jobId: 10042,
  },
  payment_released: {
    messageText: "Payment of $280.00 has been released to your account — thanks for a great clean.",
    jobId: 10042,
  },
  funds_ready: {
    messageText: "Funds for Job #10042 are ready to release — review photos and the checklist, then release when satisfied.",
    jobId: 10042,
  },
  dispute_opened: {
    messageText: "A dispute was opened for Job #10042 — please open the job and add your side.",
    jobId: 10042,
  },
  dispute_resolved: {
    messageText: "The dispute for Job #10042 is resolved — check the job for the outcome and next steps.",
    jobId: 10042,
  },
  birthday: {
    messageText: "Happy birthday from the Bond Back team — thanks for being part of the community.",
    jobId: null,
    senderName: "Bond Back",
  },
};

export function getSampleDataForType(type: string): SampleData {
  return (
    SAMPLE_DATA[type] ?? {
      messageText: "Sample notification for " + type + " — open Bond Back for full details.",
      jobId: 10042,
      senderName: "Sample User",
      listingId: 10042,
    }
  );
}
