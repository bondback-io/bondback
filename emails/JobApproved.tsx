import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailPublicOrigin } from "./email-public-url";

const APP_URL = emailPublicOrigin();

export interface JobApprovedProps {
  jobId: number | string;
  messageText: string;
}

export function JobApproved({ jobId, messageText }: JobApprovedProps) {
  const viewJobUrl = `${APP_URL}/jobs/${jobId}`;

  return (
    <EmailLayout
      preview="Green light — you’re cleared to start this bond clean"
      viewJobUrl={viewJobUrl}
      viewJobLabel="Open job"
    >
      <Section>
        <Text style={title}>You’re good to go — start the clean 🧹</Text>
        <Text style={body}>{messageText}</Text>
        <Text style={subtext}>
          Check the checklist, snap your after photos, and keep the chat warm—happy listers release payment
          faster.
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
