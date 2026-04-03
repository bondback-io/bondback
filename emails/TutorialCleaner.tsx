import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bondback.io";

export interface TutorialCleanerProps {
  firstName?: string;
}

export function TutorialCleaner({ firstName }: TutorialCleanerProps) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const jobsUrl = `${APP_URL}/jobs`;
  const earningsUrl = `${APP_URL}/earnings`;

  return (
    <EmailLayout
      preview="Your Quick Start Guide as a Cleaner"
      viewJobUrl={jobsUrl}
      viewJobLabel="Browse jobs"
    >
      <Section>
        <Text style={title}>Your Quick Start Guide as a Cleaner</Text>
        <Text style={body}>{greeting}</Text>
        <Text style={body}>
          Here&apos;s how to win jobs and get paid on Bond Back:
        </Text>

        <Text style={step}>1. Browse live jobs</Text>
        <Text style={stepBody}>
          Listings show location, move-out date, and details. Place a lower bid
          to compete, or use Buy Now if the price works for you.
        </Text>
        <Text style={link}>
          <a href={jobsUrl} style={linkStyle}>
            Browse jobs →
          </a>
        </Text>

        <Text style={step}>2. Bid or Buy Now</Text>
        <Text style={stepBody}>
          In a reverse auction, the lowest bid wins. You can also Buy Now at the
          listed price for an instant booking.
        </Text>

        <Text style={step}>3. Upload photos and complete the job</Text>
        <Text style={stepBody}>
          Once the lister approves you, coordinate via messages. After the
          clean, upload before/after photos. The lister reviews and approves,
          then releases payment.
        </Text>

        <Text style={step}>4. Get paid</Text>
        <Text style={stepBody}>
          When the lister releases payment, funds go to your account. Track
          payouts in Earnings.
        </Text>
        <Text style={link}>
          <a href={earningsUrl} style={linkStyle}>
            View earnings →
          </a>
        </Text>

        <Text style={proTip}>
          <strong>Pro tip:</strong> Set your travel radius and suburb in your
          profile so you only see jobs you can realistically do.
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
