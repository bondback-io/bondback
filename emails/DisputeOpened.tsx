import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailPublicOrigin } from "./email-public-url";

const APP_URL = emailPublicOrigin();

export interface DisputeOpenedProps {
  jobId: number | string;
  messageText: string;
}

export function DisputeOpened({ jobId, messageText }: DisputeOpenedProps) {
  const viewJobUrl = `${APP_URL}/jobs/${jobId}`;

  return (
    <EmailLayout
      preview={`Dispute opened on Job #${jobId} — we’re here to help`}
      viewJobUrl={viewJobUrl}
      viewJobLabel="View job & respond"
    >
      <Section>
        <Text style={title}>A dispute was raised — let’s sort it calmly ⚖️</Text>
        <Text style={body}>{messageText}</Text>
        <Text style={subtext}>
          Jump into the job, add photos or notes, and reply promptly. We review both sides fairly—no
          kangaroo courts here.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const title = {
  color: "#0f172a",
  fontSize: "19px",
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
