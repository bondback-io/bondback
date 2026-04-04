import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailPublicOrigin } from "./email-public-url";

const APP_URL = emailPublicOrigin();

export interface TutorialCleanerProps {
  firstName?: string;
}

export function TutorialCleaner({ firstName }: TutorialCleanerProps) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const jobsUrl = `${APP_URL}/jobs`;
  const earningsUrl = `${APP_URL}/earnings`;

  return (
    <EmailLayout
      preview="Cleaner quick start — browse, bid, shine, get paid"
      viewJobUrl={jobsUrl}
      viewJobLabel="Browse jobs"
    >
      <Section>
        <Text style={title}>🧹 Bond Back for cleaners (the short version)</Text>
        <Text style={body}>{greeting}</Text>
        <Text style={body}>
          Win work, deliver a cracker clean, and get paid with funds held safely until handover.
        </Text>

        <Text style={step}>1. Browse jobs near you</Text>
        <Text style={stepBody}>
          Listings show what matters: location, timing, scope. Place a competitive bid or tap Buy Now when the
          numbers work.
        </Text>
        <Text style={link}>
          <a href={jobsUrl} style={linkStyle}>
            See what&apos;s live →
          </a>
        </Text>

        <Text style={step}>2. Bid or Buy Now</Text>
        <Text style={stepBody}>
          Lowest bid wins in the auction — or lock it in with Buy Now when the price is right.
        </Text>

        <Text style={step}>3. Complete & upload proof</Text>
        <Text style={stepBody}>
          Approved? Coordinate in chat, nail the clean, then upload before/after photos so the lister can sign
          off with confidence.
        </Text>

        <Text style={step}>4. Get paid</Text>
        <Text style={stepBody}>
          The lister releases payment when they&apos;re happy. Track payouts and history in Earnings — your
          accountant will love you.
        </Text>
        <Text style={link}>
          <a href={earningsUrl} style={linkStyle}>
            Earnings →
          </a>
        </Text>

        <Text style={proTip}>
          <strong>Hot tip:</strong> Tighten your travel radius in profile so you only see jobs that make
          sense after petrol and coffee.
        </Text>

        <Text style={signOff}>– The Bond Back team</Text>
      </Section>
    </EmailLayout>
  );
}

const title = {
  color: "#0f172a",
  fontSize: "20px",
  fontWeight: "700" as const,
  margin: "0 0 12px 0",
  lineHeight: 1.35,
};

const body = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.65,
  margin: "0 0 16px 0",
};

const step = {
  color: "#0f172a",
  fontSize: "15px",
  fontWeight: "600" as const,
  margin: "20px 0 6px 0",
};

const stepBody = {
  color: "#475569",
  fontSize: "14px",
  lineHeight: 1.55,
  margin: "0 0 8px 0",
};

const link = {
  margin: "0 0 8px 0",
};

const linkStyle = {
  color: "#1d4ed8",
  fontWeight: "600" as const,
  textDecoration: "underline",
};

const proTip = {
  backgroundColor: "#ecfdf5",
  borderLeft: "4px solid #059669",
  color: "#065f46",
  fontSize: "14px",
  padding: "12px 16px",
  margin: "20px 0 0 0",
  borderRadius: "0 6px 6px 0",
  lineHeight: 1.55,
};

const signOff = {
  color: "#64748b",
  fontSize: "14px",
  margin: "24px 0 0 0",
};
