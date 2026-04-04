import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailPublicOrigin } from "./email-public-url";

const APP_URL = emailPublicOrigin();

export interface JobCancelledByListerProps {
  jobId: number | string;
  messageText: string;
}

export function JobCancelledByLister({ jobId, messageText }: JobCancelledByListerProps) {
  const viewJobUrl = `${APP_URL}/jobs/${jobId}`;

  return (
    <EmailLayout
      preview="This listing was cancelled — plenty more fish in the feed"
      viewJobUrl={viewJobUrl}
      viewJobLabel="Browse other jobs"
    >
      <Section>
        <Text style={title}>Listing cancelled — you’re free to move on</Text>
        <Text style={body}>{messageText}</Text>
        <Text style={subtext}>
          The lister pulled this one—no stress. Jump back to the job board; there’s always another bond
          clean around the corner.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const title = {
  color: "#0f172a",
  fontSize: "18px",
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
