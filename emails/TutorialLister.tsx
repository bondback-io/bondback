import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailMyListingsUrl, emailNewListingUrl } from "@/lib/marketplace/email-links";

export interface TutorialListerProps {
  firstName?: string;
}

export function TutorialLister({ firstName }: TutorialListerProps) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const createUrl = emailNewListingUrl();
  const myListingsUrl = emailMyListingsUrl();

  return (
    <EmailLayout
      preview="Lister quick start — list, bid, approve, release"
      viewJobUrl={myListingsUrl}
      viewJobLabel="My listings"
    >
      <Section>
        <Text style={title}>🏠 Bond Back for listers (the short version)</Text>
        <Text style={body}>{greeting}</Text>
        <Text style={body}>
          Here&apos;s the fast path to booking a bond clean without the endless phone tag.
        </Text>

        <Text style={step}>1. Create a listing</Text>
        <Text style={stepBody}>
          Photos, move-out date, access quirks — the works. Good detail attracts sharper bids (and fewer
          “quick question…” messages).
        </Text>
        <Text style={link}>
          <a href={createUrl} style={linkStyle}>
            Start your listing →
          </a>
        </Text>

        <Text style={step}>2. Watch bids roll in</Text>
        <Text style={stepBody}>
          Reverse auction: cleaners compete on price. Compare bids and profiles, then accept when
          you&apos;re happy — job chat unlocks after you pay &amp; start the job, so coordination stays
          in-app and on-platform.
        </Text>

        <Text style={step}>3. Approve & coordinate</Text>
        <Text style={stepBody}>
          Once you accept, approve the job to start so your cleaner gets the checklist and details. Keep comms
          in-app — handy if anyone needs to scroll back.
        </Text>

        <Text style={proTip}>
          <strong>Hot tip:</strong> Mention parking, strata rules, or key pickup upfront — saves everyone a
          headache on the day.
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
  backgroundColor: "#eff6ff",
  borderLeft: "4px solid #2563eb",
  color: "#1e3a8a",
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
