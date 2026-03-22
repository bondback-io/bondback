import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";

export interface TutorialListerProps {
  firstName?: string;
}

export function TutorialLister({ firstName }: TutorialListerProps) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const createUrl = `${APP_URL}/listings/new`;
  const myListingsUrl = `${APP_URL}/my-listings`;

  return (
    <EmailLayout
      preview="Your Quick Start Guide as a Lister"
      viewJobUrl={myListingsUrl}
      viewJobLabel="View my listings"
    >
      <Section>
        <Text style={title}>Your Quick Start Guide as a Lister</Text>
        <Text style={body}>{greeting}</Text>
        <Text style={body}>
          Here&apos;s how to get your first bond clean booked on Bond Back:
        </Text>

        <Text style={step}>1. Create a listing</Text>
        <Text style={stepBody}>
          Add your property details, move-out date, and photos. Cleaners will
          see your listing and place bids.
        </Text>
        <Text style={link}>
          <a href={createUrl} style={linkStyle}>
            Create your first listing →
          </a>
        </Text>

        <Text style={step}>2. Review bids</Text>
        <Text style={stepBody}>
          Cleaners submit lower bids in a reverse auction. You can accept a bid
          you like or wait for more.
        </Text>

        <Text style={step}>3. Approve the job and coordinate</Text>
        <Text style={stepBody}>
          Once you accept a bid, the job is created. Approve the cleaner to
          start, then use messages to coordinate the clean and handover.
        </Text>

        <Text style={proTip}>
          <strong>Pro tip:</strong> Adding clear photos and a good description
          helps cleaners bid accurately and reduces back-and-forth.
        </Text>

        <Text style={signOff}>– The Bond Back team</Text>
      </Section>
    </EmailLayout>
  );
}

const title = {
  color: "#111827",
  fontSize: "18px",
  fontWeight: "600",
  margin: "0 0 12px 0",
  lineHeight: 1.3,
};

const body = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: 1.6,
  margin: "0 0 16px 0",
};

const step = {
  color: "#111827",
  fontSize: "15px",
  fontWeight: "600",
  margin: "20px 0 6px 0",
};

const stepBody = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: 1.5,
  margin: "0 0 8px 0",
};

const link = {
  margin: "0 0 8px 0",
};

const linkStyle = {
  color: "#3b82f6",
  textDecoration: "underline",
};

const proTip = {
  backgroundColor: "#eff6ff",
  borderLeft: "4px solid #3b82f6",
  color: "#1e40af",
  fontSize: "14px",
  padding: "12px 16px",
  margin: "20px 0 0 0",
  borderRadius: "0 4px 4px 0",
};

const signOff = {
  color: "#6b7280",
  fontSize: "14px",
  margin: "24px 0 0 0",
};
