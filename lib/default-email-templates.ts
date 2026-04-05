/**
 * Default professional email template content for all types.
 * Used to pre-fill admin templates and as fallback when a template is empty.
 * Style: clear, actionable, similar to Airtasker/Upwork marketplace notifications.
 */

import type { EmailTemplateType } from "./admin-email-templates-utils";
import { EMAIL_TEMPLATE_TYPES } from "./admin-email-templates-utils";

export type DefaultTemplate = { subject: string; body: string };

const APP_NAME = "Bond Back";
/** Canonical public site for links in admin default copy (always www). */
const APP_URL = "https://www.bondback.io";
const PH_JOB = "{{jobId}}";
const PH_LISTING = "{{listingId}}";
const PH_MESSAGE = "{{message}}";
const PH_SENDER = "{{senderName}}";

function buildTemplates(): Record<EmailTemplateType, DefaultTemplate> {
  return {
    welcome: {
      subject: "Welcome to " + APP_NAME + " – your bond cleaning solution",
      body: "Hi {name},\n\n**Welcome to " + APP_NAME + "** – the marketplace that gets your rental bond back, fast.\n\n**Why " + APP_NAME + "?**\n- **Listers:** Create a listing, receive competitive bids from verified cleaners, and choose the best offer. One place, less stress.\n- **Cleaners:** Browse local bond clean jobs, place bids or Buy Now, and get paid securely when the job is done.\n\n**Your next step:** Complete your profile, then head to your dashboard to create a listing or browse jobs.\n\n**Trust & support:** Secure payments, 48-hour release protection, and dispute resolution. Need help? Reply to this email or visit " + APP_URL + ".\n\n[Go to dashboard](" + APP_URL + "/dashboard)\n\nThe " + APP_NAME + " team",
    },
    tutorial_lister: {
      subject: "3 steps to list your bond clean – " + APP_NAME,
      body: "Hi {name},\n\nHere’s how to get your bond clean done on " + APP_NAME + ":\n\n**1. Create your listing** – Add property details, move-out date, and any special requirements. Photos and clear instructions get better bids.\n\n**2. Review bids** – Cleaners send you offers. Compare prices and profiles; put must-knows in your listing description upfront.\n\n**3. Accept & pay & start** – Choose a cleaner, then pay & start the job. Job chat unlocks once the job is in progress so you can coordinate in-app; use the checklist and release payment when you’re happy.\n\n**Pro tip:** The more detail you add, the more accurate (and competitive) bids you’ll receive.\n\n[Get started](" + APP_URL + "/dashboard)\n\nThe " + APP_NAME + " team",
    },
    tutorial_cleaner: {
      subject: "3 steps to win bond clean jobs – " + APP_NAME,
      body: "Hi {name},\n\nHere’s how to win and complete jobs on " + APP_NAME + ":\n\n**1. Browse listings** – Find bond cleans in your area. Filter by location and move-out date.\n\n**2. Place a bid** – Send a clear offer and a short message. A complete profile and quick replies help listers choose you.\n\n**3. Get hired & complete** – When the lister accepts, they’ll approve the job so you get the address and checklist. Complete the work, upload after-photos, and get paid when they release funds.\n\n**Pro tip:** Stand out with your experience and a friendly, professional message.\n\n[Browse jobs](" + APP_URL + "/dashboard)\n\nThe " + APP_NAME + " team",
    },
    new_bid: {
      subject: "New bid on {listingTitle} – " + APP_NAME,
      body: "Hi {name},\n\nYou’ve received a **new bid** on your listing.\n\n**Listing:** {listingTitle}\n**Bid amount:** [Amount]\n**Message:** " + PH_MESSAGE + "\n\nReview the cleaner’s profile and bid note — accept or decline. Job chat opens after you pay & start the job (in progress) so you can coordinate on-platform. Secure payments and 48-hour protection included.\n\n[View bid](" + APP_URL + "/listings/" + PH_LISTING + ")\n\nThe " + APP_NAME + " team",
    },
    new_message: {
      subject: "New message in Job #[JobId] – " + APP_NAME,
      body: "Hi {name},\n\nYou have a new message in your job chat.\n\n**From:** " + PH_SENDER + "\n**Message:** " + PH_MESSAGE + "\n\nReply in the app to keep everything in one place and stay on track.\n\n[Open job chat](" + APP_URL + "/jobs/" + PH_JOB + ")\n\nThe " + APP_NAME + " team",
    },
    job_created: {
      subject: "Your job is accepted – pay & start job – " + APP_NAME,
      body: "Hi {name},\n\nGreat news – a cleaner has accepted your job.\n\n**Job:** {listingTitle}\n**Job #:** [JobId]\n\n**Next step:** Pay & Start Job to hold funds in escrow and start the job. The cleaner will then see the checklist and address. Use the job chat to agree on timing and details.\n\n[Pay & Start Job](" + APP_URL + "/jobs/" + PH_JOB + ")\n\nThe " + APP_NAME + " team",
    },
    job_accepted: {
      subject: "You're approved to start – Job #[JobId] – " + APP_NAME,
      body: "Hi {name},\n\nThe lister has approved the job. You can start the bond clean.\n\n**Job:** {listingTitle}\n**Job #:** [JobId]\n\n**What to do:**\n- Check the job for the address and cleaning checklist.\n- Use the chat to confirm the time and any access details.\n- Complete the checklist and upload after-photos when you're done.\n\n[View job and checklist](" + APP_URL + "/jobs/" + PH_JOB + ")\n\nThe " + APP_NAME + " team",
    },
    job_approved_to_start: {
      subject: "Go ahead — start Job #[JobId] – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "The lister has **approved the job to start**. You’re cleared to begin the bond clean.\n\n" +
        "**Job:** {listingTitle}\n**Job #:** [JobId]\n\n" +
        "**Next steps:**\n" +
        "- Open the job for the property address and checklist.\n" +
        "- Confirm timing in chat if needed.\n" +
        "- Complete the work and upload after-photos when finished.\n\n" +
        "[Start job & checklist](" +
        APP_URL +
        "/jobs/" +
        PH_JOB +
        ")\n\nThe " +
        APP_NAME +
        " team",
    },
    job_completed: {
      subject: "Job #[JobId] complete – review & approve & release funds – " + APP_NAME,
      body: "Hi {name},\n\nThe cleaner has marked **Job #[JobId]** as complete and uploaded after-photos.\n\n**Next step:** Review the checklist and photos. If everything looks good, approve & release funds from escrow. You have 48 hours to review or open a dispute if needed.\n\n[View job & approve & release funds](" + APP_URL + "/jobs/" + PH_JOB + ")\n\nThe " + APP_NAME + " team",
    },
    job_cancelled_by_lister: {
      subject: "Listing cancelled – Job #[JobId] – " + APP_NAME,
      body:
        "Hi {name},\n\nThe property lister has **cancelled** the listing linked to Job #[JobId]. You have been unassigned from this job.\n\nIf you had questions about timing or scope, you can browse other bond cleans on the marketplace.\n\n[Browse jobs](" +
        APP_URL +
        "/jobs)\n\nThe " +
        APP_NAME +
        " team",
    },
    payment_released: {
      subject: "Payment of [Amount] released – thank you – " + APP_NAME,
      body: "Hi {name},\n\nPayment of **[Amount]** for Job #[JobId] has been released to you.\n\nThank you for completing this bond clean through " + APP_NAME + ". We hope the experience was smooth.\n\n**What's next?** You can leave a review for the lister from your dashboard.\n\n[View job](" + APP_URL + "/jobs/" + PH_JOB + ")\n\nThe " + APP_NAME + " team",
    },
    funds_ready: {
      subject: "Funds ready to release – Job #[JobId] – " + APP_NAME,
      body: "Hi {name},\n\nThe cleaner has completed the checklist and uploaded after-photos. Funds for Job #[JobId] are ready for you to release.\n\n**Next step:** Review the work and photos. When you're satisfied, release the payment. The cleaner will be notified once it's done.\n\n[Review and release funds](" + APP_URL + "/jobs/" + PH_JOB + ")\n\nThe " + APP_NAME + " team",
    },
    dispute_opened: {
      subject: "Dispute opened for Job #[JobId] – action needed – " + APP_NAME,
      body: "Hi {name},\n\nA dispute has been opened for Job #[JobId].\n\n**What to do:** Please go to the job page to view the details and submit your response. We'll use both sides to help resolve the issue fairly.\n\n[View dispute and respond](" + APP_URL + "/jobs/" + PH_JOB + ")\n\nThe " + APP_NAME + " team",
    },
    dispute_resolved: {
      subject: "Dispute resolved – Job #[JobId] – " + APP_NAME,
      body: "Hi {name},\n\nThe dispute for Job #[JobId] has been resolved.\n\n**Next steps:** Check the job page for the outcome and any next actions (e.g. payment release or refund).\n\n[View job](" + APP_URL + "/jobs/" + PH_JOB + ")\n\nThe " + APP_NAME + " team",
    },
    birthday: {
      subject: "Happy Birthday, {name}! 🎂 – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "**Happy Birthday!** 🎉\n\n" +
        "From everyone at " + APP_NAME + ", we hope your day is filled with joy and celebration. Thank you for being part of our community—whether you're listing bond cleans or getting them done, we're glad you're here.\n\n" +
        "We wish you a fantastic year ahead and look forward to helping you with your next bond clean when the time comes.\n\n" +
        "Enjoy your special day!\n\n" +
        "[Visit " + APP_NAME + "](" + APP_URL + ")\n\n" +
        "Warm wishes,\nThe " + APP_NAME + " team",
    },
  };
}

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateType, DefaultTemplate> = buildTemplates();

export function getDefaultTemplate(type: string): DefaultTemplate | null {
  if (EMAIL_TEMPLATE_TYPES.includes(type as EmailTemplateType)) {
    return DEFAULT_EMAIL_TEMPLATES[type as EmailTemplateType] ?? null;
  }
  return null;
}

export function getAllDefaultTemplates(): Record<string, DefaultTemplate> {
  const out: Record<string, DefaultTemplate> = {};
  for (const type of EMAIL_TEMPLATE_TYPES) {
    out[type] = DEFAULT_EMAIL_TEMPLATES[type];
  }
  return out;
}
