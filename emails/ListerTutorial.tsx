import { Section, Text, Link } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";

export const LISTER_TUTORIAL_PREHEADER = "Get your first bond clean job done fast";

export interface ListerTutorialProps {
  firstName?: string;
}

const STEPS = [
  {
    emoji: "📝",
    title: "Create a listing",
    body: "Add your property details, move-out date, and photos. Cleaners will see your listing and place bids.",
    learnUrl: `${APP_URL}/listings/new`,
    learnLabel: "Create your first listing",
  },
  {
    emoji: "💵",
    title: "Set your reserve",
    body: "Choose a maximum price you're willing to pay. Cleaners bid below it in a reverse auction.",
    learnUrl: `${APP_URL}/listings/new`,
    learnLabel: "Learn more",
  },
  {
    emoji: "📊",
    title: "Review bids",
    body: "Cleaners submit lower bids. Accept one you like or wait for more—you're in control.",
    learnUrl: `${APP_URL}/my-listings`,
    learnLabel: "View my listings",
  },
  {
    emoji: "✅",
    title: "Approve & release funds",
    body: "Once the clean is done, review photos, approve the job, and release payment. Your bond is one step closer.",
    learnUrl: `${APP_URL}/my-listings`,
    learnLabel: "Manage listings & jobs",
  },
] as const;

export function ListerTutorial({ firstName }: ListerTutorialProps) {
  const greeting = firstName
    ? `Hi ${firstName}, thanks for choosing Bond Back!`
    : "Thanks for choosing Bond Back!";

  return (
    <EmailLayout
      preview={LISTER_TUTORIAL_PREHEADER}
      viewJobUrl={`${APP_URL}/dashboard`}
      viewJobLabel="Get Started Now"
    >
      <Section style={contentSection}>
        <Text style={guideTitle}>Your Lister Quick Start Guide</Text>
        <Text style={body}>{greeting}</Text>
        <Text style={intro}>
          Here&apos;s how to get your first bond clean booked in four simple steps:
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
            Upload clear photos and a short description of the property. Cleaners bid more accurately and you&apos;ll get better results faster.
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
