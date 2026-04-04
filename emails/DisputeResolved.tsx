import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailPublicOrigin } from "./email-public-url";

const APP_URL = emailPublicOrigin();

export interface DisputeResolvedProps {
  jobId: number | string;
  messageText: string;
}

export function DisputeResolved({ jobId, messageText }: DisputeResolvedProps) {
  const viewJobUrl = `${APP_URL}/jobs/${jobId}`;

  return (
    <EmailLayout
      preview="Dispute closed — here’s what happens next"
      viewJobUrl={viewJobUrl}
      viewJobLabel="View outcome"
    >
      <Section>
        <Text style={title}>Dispute resolved — moving forward 🤝</Text>
        <Text style={body}>{messageText}</Text>
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
  margin: "0",
};
