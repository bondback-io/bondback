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
  "job_completed",
  "job_cancelled_by_lister",
  "payment_released",
  "funds_ready",
  "dispute_opened",
  "dispute_resolved",
  "birthday",
] as const;

export type EmailTemplateType = (typeof EMAIL_TEMPLATE_TYPES)[number];

const LABELS: Record<string, string> = {
  welcome: "Welcome",
  tutorial_lister: "Tutorial (Lister)",
  tutorial_cleaner: "Tutorial (Cleaner)",
  new_bid: "New bid on listing",
  new_message: "New message in job",
  job_created: "Job created",
  job_accepted: "Job accepted / approved to start",
  job_completed: "Job marked complete",
  job_cancelled_by_lister: "Job cancelled by lister",
  payment_released: "Payment released",
  funds_ready: "Funds ready to release",
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
    messageText: "Welcome to Bond Back! Complete your profile to get started.",
    jobId: null,
    senderName: "Bond Back",
  },
  tutorial_lister: {
    messageText: "Quick start: post your listing, review bids, and hire a cleaner.",
    jobId: null,
    senderName: "Bond Back",
  },
  tutorial_cleaner: {
    messageText: "Quick start: browse jobs, place bids, and get hired.",
    jobId: null,
    senderName: "Bond Back",
  },
  new_bid: {
    messageText: "I can do this bond clean for $280. Available this weekend.",
    jobId: 10042,
    listingId: 10042,
  },
  new_message: {
    messageText: "Hi, would Tuesday 2pm work for the clean?",
    jobId: 10042,
    senderName: "Alex Smith",
  },
  job_created: {
    messageText: "Your job has been accepted. Start coordinating with your cleaner.",
    jobId: 10042,
  },
  job_accepted: {
    messageText: "The lister has approved you. You can now start the job.",
    jobId: 10042,
  },
  job_completed: {
    messageText: "Cleaner marked the job complete. Please review and release payment.",
    jobId: 10042,
  },
  job_cancelled_by_lister: {
    messageText: "This job listing has been cancelled by the property lister. You have been unassigned from the job.",
    jobId: 10042,
  },
  payment_released: {
    messageText: "Payment of $280 has been released to your account. Thank you!",
    jobId: 10042,
  },
  funds_ready: {
    messageText: "Funds are ready to release for Job #10042. Review and release when satisfied.",
    jobId: 10042,
  },
  dispute_opened: {
    messageText: "A dispute has been opened for Job #10042. Please respond in the app.",
    jobId: 10042,
  },
  dispute_resolved: {
    messageText: "The dispute for Job #10042 has been resolved.",
    jobId: 10042,
  },
  birthday: {
    messageText: "Happy birthday from Bond Back!",
    jobId: null,
    senderName: "Bond Back",
  },
};

export function getSampleDataForType(type: string): SampleData {
  return (
    SAMPLE_DATA[type] ?? {
      messageText: "Sample notification message for " + type,
      jobId: 10042,
      senderName: "Sample User",
      listingId: 10042,
    }
  );
}
