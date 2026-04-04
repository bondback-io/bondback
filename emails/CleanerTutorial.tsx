import { Section, Text, Link } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailPublicOrigin } from "./email-public-url";

const APP_URL = emailPublicOrigin();

export const CLEANER_TUTORIAL_PREHEADER =
  "From browse to paid — your five-step Bond Back rhythm";

export interface CleanerTutorialProps {
  firstName?: string;
}

const STEPS = [
  {
    emoji: "🔍",
    title: "Hunt jobs that fit",
    body: "Filter by suburb and travel radius so you’re not crossing the Harbour Bridge for a studio clean unless you really want to.",
    learnUrl: `${APP_URL}/jobs`,
    learnLabel: "Browse jobs",
  },
  {
    emoji: "🛒",
    title: "Bid smart or Buy Now",
    body: "Reverse auction = lowest bid wins. Spot a price you’re happy with? Buy Now can lock it in before someone else does.",
    learnUrl: `${APP_URL}/jobs`,
    learnLabel: "See live listings",
  },
  {
    emoji: "💬",
    title: "Chat like a pro",
    body: "Once you’re approved, use in-app messages for keys, parking, and timing — keeps everything above board if questions pop up later.",
    learnUrl: `${APP_URL}/dashboard`,
    learnLabel: "Dashboard",
  },
  {
    emoji: "📷",
    title: "Show your work",
    body: "Before/after photos aren’t just for Instagram — they help listers approve fast and protect you if anything’s questioned.",
    learnUrl: `${APP_URL}/dashboard`,
    learnLabel: "Upload from dashboard",
  },
  {
    emoji: "💰",
    title: "Get paid",
    body: "When the lister releases funds, money heads your way. Track it all under Earnings — no shoebox of invoices required.",
    learnUrl: `${APP_URL}/earnings`,
    learnLabel: "View earnings",
  },
] as const;

export function CleanerTutorial({ firstName }: CleanerTutorialProps) {
  const greeting = firstName
    ? `Hi ${firstName}, stoked to have you on the tools with Bond Back.`
    : "Stoked to have you on the tools with Bond Back.";

  return (
    <EmailLayout
      preview={CLEANER_TUTORIAL_PREHEADER}
      viewJobUrl={`${APP_URL}/dashboard`}
      viewJobLabel="Open your dashboard"
    >
      <Section style={contentSection}>
        <Text style={guideTitle}>🧹 Your cleaner playbook</Text>
        <Text style={body}>{greeting}</Text>
        <Text style={intro}>
          Five steps from browsing to getting paid — with escrow keeping everyone honest along the way.
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
          <Text style={proTipTitle}>💡 Ripper tip</Text>
          <Text style={proTipBody}>
            Solid before/afters and quick replies win more jobs — listers notice who shows up organised.
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
