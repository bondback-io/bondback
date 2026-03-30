/**
 * Pure placeholder substitution for admin-edited email bodies (markdown → HTML) and subjects.
 * Keep in sync with default copy in lib/default-email-templates.ts.
 */

export type EmailPlaceholderValues = {
  messageText: string;
  jobId: string;
  listingId: string;
  senderName: string;
  /** Recipient’s first name or short name */
  name: string;
  recipientName: string;
  listerName: string;
  cleanerName: string;
  listingTitle: string;
  /** Display amount e.g. "$280" */
  amount: string;
  role: string;
  suburb: string;
};

const VALUED = "Valued User";

/** Extract $X from message for payment-style copy */
export function parseAmountFromMessageForEmail(messageText: string): string | undefined {
  const match = messageText.match(/\$(\d+(?:\.\d{2})?)/);
  return match ? `$${match[1]}` : undefined;
}

/**
 * Replace all supported placeholder forms in a string (HTML or plain).
 * Supports: {{message}}, {{jobId}}, {{senderName}}, {{listingId}},
 * {name}, {listingTitle}, {jobId}, {amount}, {suburb}, {role}, {listerName}, {cleanerName}, {recipientName},
 * {lister name}, {cleaner name}, {lister name} (spaced),
 * [JobId], [Amount], [Name], [Role].
 */
export function substituteEmailTemplatePlaceholders(
  text: string,
  v: EmailPlaceholderValues
): string {
  const msg = v.messageText ?? "";
  const jobId = v.jobId || "—";
  const listingId = v.listingId || jobId;
  const sender = v.senderName || "someone";
  const name = v.name?.trim() || VALUED;
  const recipientName = v.recipientName?.trim() || name;
  const lister = v.listerName?.trim() || "—";
  const cleaner = v.cleanerName?.trim() || "—";
  const listingTitle = v.listingTitle?.trim() || "Your listing";
  const amount = v.amount?.trim() || "$0";
  const role = v.role?.trim() || "Member";
  const suburb = v.suburb?.trim() || "—";

  return text
    .replace(/\{\{message\}\}/g, msg)
    .replace(/\{\{jobId\}\}/g, jobId)
    .replace(/\{\{senderName\}\}/g, sender)
    .replace(/\{\{listingId\}\}/g, listingId)
    .replace(/\{\{listingTitle\}\}/g, listingTitle)
    .replace(/\{\{amount\}\}/g, amount)
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{recipientName\}\}/g, recipientName)
    .replace(/\{\{listerName\}\}/g, lister)
    .replace(/\{\{cleanerName\}\}/g, cleaner)
    .replace(/\[Name\]/g, name)
    .replace(/\[Role\]/g, role)
    .replace(/\[JobId\]/g, jobId)
    .replace(/\[Amount\]/g, amount)
    .replace(/\{lister\s+name\}/gi, lister)
    .replace(/\{cleaner\s+name\}/gi, cleaner)
    .replace(/\{recipientName\}/gi, recipientName)
    .replace(/\{listerName\}/gi, lister)
    .replace(/\{cleanerName\}/gi, cleaner)
    .replace(/\{listingTitle\}/gi, listingTitle)
    .replace(/\{senderName\}/gi, sender)
    .replace(/\{message\}/gi, msg)
    .replace(/\{name\}/gi, name)
    .replace(/\{role\}/gi, role)
    .replace(/\{jobId\}/gi, jobId)
    .replace(/\{listingId\}/gi, listingId)
    .replace(/\{suburb\}/gi, suburb)
    .replace(/\{amount\}/gi, amount);
}

export type TestDataInputLike = {
  messageText?: string;
  jobId?: string;
  senderName?: string;
  listingId?: string;
  name?: string;
  role?: string;
  amount?: string;
  listingTitle?: string;
  suburb?: string;
  listerName?: string;
  cleanerName?: string;
};

/** Map admin test / preview form fields to placeholder values (no DB). */
export function placeholderValuesFromTestDataInput(d: TestDataInputLike): EmailPlaceholderValues {
  const jobId = (d.jobId ?? "10042").trim() || "10042";
  const listingId = (d.listingId ?? jobId).trim() || jobId;
  const name = (d.name ?? "Alex").trim() || VALUED;
  return {
    messageText: d.messageText ?? "",
    jobId,
    listingId,
    senderName: (d.senderName ?? "Alex Smith").trim() || "someone",
    name,
    recipientName: name,
    listerName: (d.listerName ?? "Jamie Chen").trim() || "—",
    cleanerName: (d.cleanerName ?? "Chris Taylor").trim() || "—",
    listingTitle: (d.listingTitle ?? "3br House Bond Clean – Sydney").trim() || "Your listing",
    amount: (d.amount ?? "$280").trim() || "$0",
    role: (d.role ?? "Lister").trim() || "Member",
    suburb: (d.suburb ?? "Sydney").trim() || "—",
  };
}
