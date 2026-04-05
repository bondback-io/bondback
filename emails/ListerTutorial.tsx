import { Section, Text, Link } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailPublicOrigin } from "./email-public-url";

const APP_URL = emailPublicOrigin();

export const LISTER_TUTORIAL_PREHEADER =
  "Four steps from listing to bond handover — minus the stress";

export interface ListerTutorialProps {
  firstName?: string;
}

const STEPS = [
  {
    emoji: "📝",
    title: "List your clean",
    body: "Add photos, move-out date, and anything quirky about access or parking. The clearer you are, the sharper the bids — no one likes guessing games at 7am on a Saturday.",
    learnUrl: `${APP_URL}/listings/new`,
    learnLabel: "Create a listing",
  },
  {
    emoji: "💵",
    title: "Set a fair reserve",
    body: "Your reserve is the ceiling; cleaners bid down in a reverse auction. Think of it as setting the bar — then watching the competition do the limbo.",
    learnUrl: `${APP_URL}/listings/new`,
    learnLabel: "How pricing works",
  },
  {
    emoji: "📊",
    title: "Compare bids & choose",
    body: "Review offers and cleaner profiles — price, experience, and reviews. Accept a bid when you’re ready. In-app job chat opens once the job is in progress (after pay & start), so access and timing stay on the platform — not lost in SMS threads.",
    learnUrl: `${APP_URL}/my-listings`,
    learnLabel: "My listings",
  },
  {
    emoji: "✅",
    title: "Approve, then release",
    body: "When the clean’s done, check the photos and checklist. Happy? Release payment from escrow. Your bond inspector can bring the magnifying glass — you’ve already done the hard yards.",
    learnUrl: `${APP_URL}/my-listings`,
    learnLabel: "Manage jobs",
  },
] as const;

export function ListerTutorial({ firstName }: ListerTutorialProps) {
  const greeting = firstName
    ? `Hi ${firstName}, welcome aboard — let’s get that bond clean sorted.`
    : "Welcome aboard — let’s get that bond clean sorted.";

  return (
    <EmailLayout
      preview={LISTER_TUTORIAL_PREHEADER}
      viewJobUrl={`${APP_URL}/dashboard`}
      viewJobLabel="Open your dashboard"
    >
      <Section style={contentSection}>
        <Text style={guideTitle}>🏠 Your lister playbook</Text>
        <Text style={body}>{greeting}</Text>
        <Text style={intro}>
          Four steps from “I need a clean” to “handover sorted” — secure pay in escrow, and in-app job
          chat once your clean is under way.
        </Text>

        {STEPS.map((step, index) => (
          <Section key={step.title} style={stepSection}>
            <Text style={stepHeading}>
              <span style={stepEmoji}>{step.emoji}</span> {index + 1}. {step.title}
            </Text>
            <Text style={stepBody}>{step.body}</Text>
            <Text style={linkWrap}>
              <Link href={step.learnUrl} style={linkStyle}>
                {step.learnLabel} →
              </Link>
            </Text>
          </Section>
        ))}

        <Section style={proTipSection}>
          <Text style={proTipTitle}>💡 Fair dinkum tip</Text>
          <Text style={proTipBody}>
            Good photos and a short “what matters most” note save back-and-forth on the day. Job chat
            picks up once the job is in progress — future you (and your cleaner) will thank you for a
            clear listing.
          </Text>
        </Section>

        <Text style={signOff}>– The Bond Back team</Text>
      </Section>
    </EmailLayout>
  );
}

const contentSection = { padding: "0 0 8px 0" };
const guideTitle = {
  color: "#0f172a",
  fontSize: "22px",
  fontWeight: "700" as const,
  margin: "0 0 16px 0",
  lineHeight: 1.3,
};
const body = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.65,
  margin: "0 0 16px 0",
};
const intro = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.65,
  margin: "0 0 20px 0",
};
const stepSection = { margin: "0 0 20px 0" };
const stepHeading = {
  color: "#0f172a",
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0 0 6px 0",
  lineHeight: 1.4,
};
const stepEmoji = { marginRight: "6px" };
const stepBody = {
  color: "#475569",
  fontSize: "14px",
  lineHeight: 1.55,
  margin: "0 0 6px 0",
};
const linkWrap = { margin: "0" };
const linkStyle = {
  color: "#1d4ed8",
  fontSize: "14px",
  fontWeight: "600" as const,
  textDecoration: "underline",
};
const proTipSection = {
  backgroundColor: "#ecfdf5",
  borderLeft: "4px solid #059669",
  padding: "14px 16px",
  margin: "24px 0 0 0",
  borderRadius: "0 8px 8px 0",
};
const proTipTitle = {
  color: "#047857",
  fontSize: "14px",
  fontWeight: "600" as const,
  margin: "0 0 6px 0",
};
const proTipBody = {
  color: "#065f46",
  fontSize: "13px",
  lineHeight: 1.55,
  margin: "0",
};
const signOff = {
  color: "#64748b",
  fontSize: "14px",
  margin: "24px 0 0 0",
};
