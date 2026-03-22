import { Section, Text, Link } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";

export const CLEANER_TUTORIAL_PREHEADER = "Get your first bond clean job done fast";

export interface CleanerTutorialProps {
  firstName?: string;
}

const STEPS = [
  {
    emoji: "🔍",
    title: "Browse jobs",
    body: "See live listings near you with location, move-out date, and details. Filter by suburb and travel radius.",
    learnUrl: `${APP_URL}/jobs`,
    learnLabel: "Browse jobs",
  },
  {
    emoji: "🛒",
    title: "Bid or Buy Now",
    body: "Place a lower bid to compete in the reverse auction, or use Buy Now at the listed price for an instant booking.",
    learnUrl: `${APP_URL}/jobs`,
    learnLabel: "Learn more",
  },
  {
    emoji: "💬",
    title: "Coordinate via chat",
    body: "Once the lister approves you, use in-app messages to coordinate access, keys, and the clean.",
    learnUrl: `${APP_URL}/dashboard`,
    learnLabel: "Open dashboard",
  },
  {
    emoji: "📷",
    title: "Upload photos",
    body: "After the clean, upload before/after photos. The lister reviews and approves, then releases payment.",
    learnUrl: `${APP_URL}/dashboard`,
    learnLabel: "Open dashboard",
  },
  {
    emoji: "💰",
    title: "Get paid",
    body: "When the lister releases payment, funds go to your account. Track payouts and history in Earnings.",
    learnUrl: `${APP_URL}/earnings`,
    learnLabel: "View earnings",
  },
] as const;

export function CleanerTutorial({ firstName }: CleanerTutorialProps) {
  const greeting = firstName
    ? `Hi ${firstName}, thanks for choosing Bond Back!`
    : "Thanks for choosing Bond Back!";

  return (
    <EmailLayout
      preview={CLEANER_TUTORIAL_PREHEADER}
      viewJobUrl={`${APP_URL}/dashboard`}
      viewJobLabel="Get Started Now"
    >
      <Section style={contentSection}>
        <Text style={guideTitle}>Your Cleaner Quick Start Guide</Text>
        <Text style={body}>{greeting}</Text>
        <Text style={intro}>
          Here&apos;s how to win jobs and get paid in five simple steps:
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
          <Text style={proTipTitle}>💡 Pro tip</Text>
          <Text style={proTipBody}>
            Upload clear before/after photos to win more jobs faster. Listers love seeing your work—and it speeds up approval and payment.
          </Text>
        </Section>

        <Text style={signOff}>– The Bond Back team</Text>
      </Section>
    </EmailLayout>
  );
}

const contentSection = { padding: "0 0 8px 0" };
const guideTitle = {
  color: "#111827",
  fontSize: "20px",
  fontWeight: "600",
  margin: "0 0 16px 0",
  lineHeight: 1.3,
};
const body = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: 1.6,
  margin: "0 0 16px 0",
};
const intro = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: 1.6,
  margin: "0 0 20px 0",
};
const stepSection = { margin: "0 0 20px 0" };
const stepHeading = {
  color: "#111827",
  fontSize: "16px",
  fontWeight: "600",
  margin: "0 0 6px 0",
  lineHeight: 1.4,
};
const stepEmoji = { marginRight: "6px" };
const stepBody = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: 1.5,
  margin: "0 0 6px 0",
};
const linkWrap = { margin: "0" };
const linkStyle = {
  color: "#3b82f6",
  fontSize: "14px",
  textDecoration: "underline",
};
const proTipSection = {
  backgroundColor: "#eff6ff",
  borderLeft: "4px solid #3b82f6",
  padding: "14px 16px",
  margin: "24px 0 0 0",
  borderRadius: "0 6px 6px 0",
};
const proTipTitle = {
  color: "#1e40af",
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 6px 0",
};
const proTipBody = {
  color: "#1e40af",
  fontSize: "13px",
  lineHeight: 1.5,
  margin: "0",
};
const signOff = {
  color: "#6b7280",
  fontSize: "14px",
  margin: "24px 0 0 0",
};
