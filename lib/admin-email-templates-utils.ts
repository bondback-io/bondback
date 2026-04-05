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
    messageText:
      "You’re in — fair bids, secure pay, one less thing to worry about before handover.",
    jobId: null,
    senderName: "Bond Back",
  },
  tutorial_lister: {
    messageText:
      "Four steps from listing to handover — reserve, bids, pay & start, then release when the place sparkles.",
    jobId: null,
    senderName: "Bond Back",
  },
  tutorial_cleaner: {
    messageText:
      "Five steps: hunt jobs, bid or Buy Now, chat when live, show before/afters, get paid — escrow keeps it fair.",
    jobId: null,
    senderName: "Bond Back",
  },
  new_bid: {
    messageText:
      "I can smash this bond clean for $280 — Sat or Sun arvo, own gear, happy to limbo under your reserve.",
    jobId: 10042,
    listingId: 10042,
  },
  new_message: {
    messageText: "G’day — Tuesday 2pm work for keys? Can shuffle if you’re on a tight runway.",
    jobId: 10042,
    senderName: "Alex Smith",
  },
  job_created: {
    messageText:
      "Cleaner’s locked in — pay & start when you’re ready so they get the checklist and address (no more phone tag).",
    jobId: 10042,
  },
  job_accepted: {
    messageText: "Lister gave the green light — grab the address, run the checklist, keep the chat warm.",
    jobId: 10042,
  },
  job_approved_to_start: {
    messageText:
      "Approved to start — open the job for address and checklist, then make that rental sparkle.",
    jobId: 10042,
  },
  job_completed: {
    messageText:
      "Clean’s done, after photos uploaded — have a squiz, then release when you’re happy (48h window).",
    jobId: 10042,
  },
  job_cancelled_by_lister: {
    messageText:
      "Lister pulled this listing — you’re unassigned. Plenty more fish (bond cleans) in the feed.",
    jobId: 10042,
  },
  payment_released: {
    messageText: "$280.00 released — cracker of a clean. Ka-ching.",
    jobId: 10042,
  },
  funds_ready: {
    messageText:
      "Checklist ticked, photos in — funds ready to release on Job #10042 when you’re satisfied.",
    jobId: 10042,
  },
  dispute_opened: {
    messageText:
      "Heads up — a dispute’s open on Job #10042. Jump in and add your side; we review both fairly.",
    jobId: 10042,
  },
  dispute_resolved: {
    messageText: "Dispute on #10042 is wrapped — check the job for outcome and next steps.",
    jobId: 10042,
  },
  birthday: {
    messageText: "Happy birthday from Bond Back — hope your day’s more barbie than bond inspection.",
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
