/**
 * Default email template copy for all types (admin “Apply defaults” + empty-row fallback).
 * Tone: Bond Back humour — Aussie, playful, clear — aligned with React Email in `emails/` and
 * subjects in `lib/notifications/email.ts`. Use markdown; placeholders match `lib/email-placeholders.ts`.
 */

import type { EmailTemplateType } from "./admin-email-templates-utils";
import { EMAIL_TEMPLATE_TYPES } from "./admin-email-templates-utils";
import { EMAIL_CANONICAL_ORIGIN } from "@/emails/email-public-url";

export type DefaultTemplate = { subject: string; body: string };

const APP_NAME = "Bond Back";
/** Canonical public site for links in admin default copy — same origin as outbound React Email. */
const APP_URL = EMAIL_CANONICAL_ORIGIN;
const PH_JOB = "{{jobId}}";
const PH_LISTING = "{{listingId}}";
const PH_MESSAGE = "{{message}}";
const PH_SENDER = "{{senderName}}";

function buildTemplates(): Record<EmailTemplateType, DefaultTemplate> {
  return {
    welcome: {
      subject: "Welcome to " + APP_NAME + " — fair cleans, secure pay 🇦🇺",
      body:
        "Hi {name},\n\n" +
        "**You’re in** — thanks for joining Australia’s bond-clean marketplace. We built this because end-of-lease stress is real, and your bond shouldn’t depend on luck (or a dodgy flyer).\n\n" +
        "**What you can do:**\n" +
        "- **Listing a clean?** Post your job, watch cleaners compete on price, and pick someone you trust — without the ring-around.\n" +
        "- **On the tools?** Browse local jobs, bid with confidence, and get paid when the work’s done — escrow keeps everyone honest.\n" +
        "- **Both?** One account; switch roles anytime.\n\n" +
        "**Trust line:** Secure payments · Escrow protection · Disputes handled fairly — we’re not here to make moving harder.\n\n" +
        "[Open your dashboard](" + APP_URL + "/dashboard)\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    tutorial_lister: {
      subject: "Your lister playbook — four steps to handover – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "Welcome aboard — let’s get that bond clean sorted. Here’s the **lister playbook** (same vibe as the email we send new listers):\n\n" +
        "**1. List your clean** — Add photos, move-out date, and anything quirky about access or parking. The clearer you are, the sharper the bids — no one likes guessing games at 7am on a Saturday.\n\n" +
        "**2. Set a fair reserve** — Your reserve is the ceiling; cleaners bid down in a reverse auction. Think of it as setting the bar, then watching the competition do the limbo.\n\n" +
        "**3. Compare bids & choose** — Job chat opens **once the job is in progress** (after pay & start), so access and timing stay on the platform — not lost in SMS threads.\n\n" +
        "**4. Approve, then release** — When the clean’s done, check the photos and checklist. Happy? Release payment from escrow.\n\n" +
        "**Fair dinkum tip:** Good photos and a short “what matters most” note save back-and-forth on the day.\n\n" +
        "[My listings](" + APP_URL + "/my-listings) · [Dashboard](" + APP_URL + "/dashboard)\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    tutorial_cleaner: {
      subject: "Your cleaner playbook — browse, clean, get paid – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "Stoked to have you on the tools. Here’s the **cleaner playbook**:\n\n" +
        "**1. Hunt jobs that fit** — Filter by suburb so you’re not crossing town for a studio clean unless you really want to.\n\n" +
        "**2. Bid smart or Buy Now** — Reverse auction = lowest bid wins. Spot a price you’re happy with? Buy Now can lock it in.\n\n" +
        "**3. Chat when the job’s live** — After you’re hired and the job is **in progress**, use in-app messages for keys, parking, and timing — keeps everything above board.\n\n" +
        "**4. Show your work** — Before/after photos help listers approve fast and protect you if anything’s questioned.\n\n" +
        "**5. Get paid** — When the lister releases funds, track it under Earnings.\n\n" +
        "**Ripper tip:** Solid photos and quick replies win more jobs.\n\n" +
        "[Browse jobs](" + APP_URL + "/jobs) · [Earnings](" + APP_URL + "/earnings)\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    new_bid: {
      subject: "Fresh bid on {listingTitle} — worth a look – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "Someone just threw their hat in the ring — **new bid** on your listing.\n\n" +
        "**Listing:** {listingTitle}\n" +
        "**Their note:** " +
        PH_MESSAGE +
        "\n\n" +
        "Have a squiz at their profile and offer. The reverse auction means lower bids win — take your time, or jump in if the price already feels fair dinkum. Job chat opens after you **pay & start** and the job is **in progress**.\n\n" +
        "[Review bids](" + APP_URL + "/listings/" + PH_LISTING + ")\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    new_message: {
      subject: "Ping! New message on Job #[JobId] – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "**" +
        PH_SENDER +
        "** sent you a message on Job **[JobId]**:\n\n" +
        "_" +
        PH_MESSAGE +
        "_\n\n" +
        "Reply in Bond Back so dates, keys, and expectations stay in one thread — much easier than digging through SMS.\n\n" +
        "[Open chat](" + APP_URL + "/jobs/" + PH_JOB + ")\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    job_created: {
      subject: "Cleaner locked in — pay & start when you’re ready – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "You’ve got a cleaner — let’s get this bond clean moving.\n\n" +
        "**Job:** {listingTitle}\n**Job #:** [JobId]\n\n" +
        "**Next step:** **Pay & start** to hold funds in escrow. Then the cleaner gets the address and checklist, and job chat opens properly for timing and keys.\n\n" +
        "[Pay & start job](" + APP_URL + "/jobs/" + PH_JOB + ")\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    job_accepted: {
      subject: "Green light: start Job #[JobId] – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "The lister’s given you the nod — **you’re cleared to start** the bond clean.\n\n" +
        "**Job:** {listingTitle}\n**Job #:** [JobId]\n\n" +
        "- Open the job for address and checklist.\n" +
        "- Confirm timing in chat if needed.\n" +
        "- Tick the checklist and upload after photos when you’re done.\n\n" +
        "Happy listers release payment faster — keep the chat warm.\n\n" +
        "[Open job](" + APP_URL + "/jobs/" + PH_JOB + ")\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    job_approved_to_start: {
      subject: "You’re cleared to begin Job #[JobId] – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "Green light from the lister — **approved to start**. Time to make that rental sparkle.\n\n" +
        "**Job:** {listingTitle}\n**Job #:** [JobId]\n\n" +
        "Grab the address, run the checklist, and upload after photos when finished.\n\n" +
        "[Start job & checklist](" + APP_URL + "/jobs/" + PH_JOB + ")\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    job_completed: {
      subject: "Photos are in — have a squiz before you pay – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "The cleaner’s marked **Job #[JobId]** complete and uploaded after photos. Time for your final look.\n\n" +
        "Happy with the checklist and pics? **Approve & release** from escrow. You’ve got **48 hours** to review or open a dispute if something’s off.\n\n" +
        "[Review & release](" + APP_URL + "/jobs/" + PH_JOB + ")\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    job_cancelled_by_lister: {
      subject: "Listing cancelled — you’re free to move on – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "The lister **cancelled** this listing (Job **[JobId]**). You’re unassigned — no stress.\n\n" +
        "Plenty more bond cleans in the feed — your next win might be a tap away.\n\n" +
        "[Browse jobs](" + APP_URL + "/jobs)\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    listing_cancelled_by_lister: {
      subject: "Auction ended early — your bid won’t carry – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "The property lister **ended this auction early**. If you had a current bid, it’s **no longer active**.\n\n" +
        "Plenty more bond cleans on the board — jump back in when you’re ready.\n\n" +
        "[Browse jobs](" + APP_URL + "/jobs)\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    payment_released: {
      subject: "Ka-ching: [Amount] released — nice one – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "**[Amount]** for Job **[JobId]** is on its way to you. Cracker of a job — thanks for using " +
        APP_NAME +
        ".\n\n" +
        "Leave a review from your dashboard when you get a sec.\n\n" +
        "[View job](" + APP_URL + "/jobs/" + PH_JOB + ")\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    funds_ready: {
      subject: "Funds ready to release — Job #[JobId] – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "The hard yards look done — checklist ticked, after photos in. **Funds are ready** for you to release on Job **[JobId]**.\n\n" +
        "Happy with everything? Tap through to release — your cleaner gets paid, and you get peace of mind.\n\n" +
        "[Review & release](" + APP_URL + "/jobs/" + PH_JOB + ")\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    dispute_opened: {
      subject: "Dispute opened — we’ll sort it fairly – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "A dispute’s been raised on **Job #[JobId]**. Deep breath — we’ll work through it properly.\n\n" +
        "Open the job, add photos or notes, and reply promptly. We review both sides — **no kangaroo courts here**.\n\n" +
        "[View job & respond](" + APP_URL + "/jobs/" + PH_JOB + ")\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    dispute_resolved: {
      subject: "Dispute wrapped up — Job #[JobId] – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "Good news — the dispute on **Job #[JobId]** is **resolved**.\n\n" +
        "Check the job page for the outcome and any next steps (payment release, refund, etc.).\n\n" +
        "[View job](" + APP_URL + "/jobs/" + PH_JOB + ")\n\n" +
        "– The " +
        APP_NAME +
        " team",
    },
    birthday: {
      subject: "Happy Birthday, {name}! 🎂 (go on, treat yourself) – " + APP_NAME,
      body:
        "Hi {name},\n\n" +
        "**Happy birthday!** 🎉\n\n" +
        "From everyone at " +
        APP_NAME +
        ", we hope your day’s more **barbie than bond inspection** — you’ve earned it. Thanks for being part of the community, whether you’re listing cleans or smashing them out.\n\n" +
        "Here’s to a ripper year — and stress-free handovers when the time comes.\n\n" +
        "[Visit " +
        APP_NAME +
        "](" +
        APP_URL +
        ")\n\n" +
        "Cheers,\nThe " +
        APP_NAME +
        " team",
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
