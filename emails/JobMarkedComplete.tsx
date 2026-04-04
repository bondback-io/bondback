import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailPublicOrigin } from "./email-public-url";

const APP_URL = emailPublicOrigin();

export interface JobMarkedCompleteProps {
  jobId: number | string;
  messageText: string;
}

export function JobMarkedComplete({ jobId, messageText }: JobMarkedCompleteProps) {
  const viewJobUrl = `${APP_URL}/jobs/${jobId}`;

  return (
    <EmailLayout
      preview="Cleaner says it’s done — time for your final look"
      viewJobUrl={viewJobUrl}
      viewJobLabel="Review job"
    >
      <Section>
        <Text style={title}>Photos are in — have a squiz before you pay 👀</Text>
        <Text style={body}>{messageText}</Text>
        <Text style={subtext}>
          If everything matches the checklist, release funds and leave a review. You’ve got a 48-hour
          window to raise a dispute if something’s off.
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
