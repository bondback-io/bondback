/**
 * Notifications stub. Safe no-op implementations for now.
 * Later: integrate Resend (email) and/or Twilio (SMS) for real delivery.
 */

export type NotifyChannel = "email" | "sms";

/** Stub: send email. Later use Resend. */
export async function notifyEmail(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  void to;
  void subject;
  void body;
}

/** Stub: send SMS. Later use Twilio. */
export async function notifySms(to: string, body: string): Promise<void> {
  void to;
  void body;
}

/** Stub: notify lister when a new bid is placed on their listing. */
export async function notifyNewBid(
  listerEmail: string,
  listingTitle: string,
  bidAmountCents: number,
  listingId: string
): Promise<void> {
  const amount = (bidAmountCents / 100).toFixed(2);
  await notifyEmail(
    listerEmail,
    `New bid on "${listingTitle}"`,
    `A cleaner placed a bid of $${amount} AUD. View: /listings/${listingId}`
  );
}

/** Stub: notify cleaner when they win the auction (lowest bid ≤ reserve at end). */
export async function notifyBidWon(
  cleanerEmail: string,
  listingTitle: string,
  amountCents: number,
  listingId: string
): Promise<void> {
  const amount = (amountCents / 100).toFixed(2);
  await notifyEmail(
    cleanerEmail,
    `You won: ${listingTitle}`,
    `Your bid of $${amount} AUD was the winning bid. Complete the job and upload before/after photos.`
  );
}

/** Stub: notify lister when their listing ends (with or without winner). */
export async function notifyListingEnded(
  listerEmail: string,
  listingTitle: string,
  listingId: string,
  hadWinner: boolean
): Promise<void> {
  await notifyEmail(
    listerEmail,
    `Listing ended: ${listingTitle}`,
    hadWinner
      ? `Your listing received a winning bid. View details: /listings/${listingId}`
      : `Your listing ended with no winning bid. You can create a new listing.`
  );
}

/** Stub: notify cleaner when job requires before/after photo upload. */
export async function notifyPhotoUploadRequired(
  cleanerEmail: string,
  listingTitle: string,
  listingId: string
): Promise<void> {
  await notifyEmail(
    cleanerEmail,
    `Upload before/after photos: ${listingTitle}`,
    `Please upload before and after photos to complete this job.`
  );
}
