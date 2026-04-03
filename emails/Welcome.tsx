import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bondback.io";

export interface WelcomeProps {
  /** First name or display name */
  firstName?: string;
  /** lister | cleaner | both */
  role: "lister" | "cleaner" | "both";
}

/** Preheader text (hidden, shown in inbox preview by some clients) */
export const WELCOME_PREHEADER =
  "Start saving time and money on bond cleans today";

export function Welcome({ firstName, role }: WelcomeProps) {
  const dashboardUrl = `${APP_URL}/dashboard`;
  const displayName = (firstName ?? "").trim() || "there";
  const greeting = `Hi ${displayName},`;

  const roleBenefits =
    role === "lister"
      ? "Create listings, receive competitive bids, get your bond back fast."
      : role === "cleaner"
        ? "Browse local jobs, bid or Buy Now, build your reputation and earnings."
        : "As a lister: create listings and get competitive bids. As a cleaner: browse jobs, bid or Buy Now, and grow your earnings.";

  return (
    <EmailLayout
      preview={WELCOME_PREHEADER}
      viewJobUrl={dashboardUrl}
      viewJobLabel="Go to Dashboard"
    >
      <Section style={contentSection}>
        <Text style={heading}>
          Welcome to Bond Back – Your Bond Cleaning Solution Awaits!
        </Text>
        <Text style={body}>{greeting}</Text>
        <Text style={body}>
          Thanks for joining Bond Back – the easiest way to find trusted
          cleaners for your bond clean.
        </Text>
        <Text style={body}>
          <strong>What you can do:</strong> {roleBenefits}
        </Text>
        <Text style={trustLine}>
          Secure payments • Verified cleaners • 48-hour protection
        </Text>
      </Section>
    </EmailLayout>
  );
}

const contentSection = {
  padding: "0 0 8px 0",
};

const heading = {
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

const trustLine = {
  color: "#6b7280",
  fontSize: "12px",
  margin: "20px 0 0 0",
  fontWeight: "500" as const,
};
