import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailPublicOrigin } from "./email-public-url";

const APP_URL = emailPublicOrigin();

export interface FundsReadyProps {
  jobId: number | string;
  messageText: string;
}

export function FundsReady({ jobId, messageText }: FundsReadyProps) {
  const viewJobUrl = `${APP_URL}/jobs/${jobId}`;

  return (
    <EmailLayout
      preview="Work looks done — release payment when you’re happy"
      viewJobUrl={viewJobUrl}
      viewJobLabel="Review & release"
    >
      <Section>
        <Text style={title}>Funds are ready to release ✅</Text>
        <Text style={body}>{messageText}</Text>
        <Text style={subtext}>
          Happy with the photos and checklist? Tap through to release—your cleaner gets paid, and you get
          peace of mind.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const title = {
  color: "#0f172a",
  fontSize: "20px",
  fontWeight: "700" as const,
  margin: "0 0 12px 0",
  lineHeight: 1.3,
};

const body = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.65,
  margin: "0 0 16px 0",
};

const subtext = {
  color: "#64748b",
  fontSize: "13px",
  margin: "0",
  lineHeight: 1.5,
};
