import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bondback.io";

export interface JobCreatedProps {
  jobId: number | string;
  messageText: string;
}

export function JobCreated({ jobId, messageText }: JobCreatedProps) {
  const viewJobUrl = `${APP_URL}/jobs/${jobId}`;
  const bodyCopy =
    (messageText ?? "").trim() ||
    "Your job is ready—open Bond Back to coordinate timing and details with the other party.";

  return (
    <EmailLayout
      preview="Your job has been accepted – start coordinating!"
      viewJobUrl={viewJobUrl}
      viewJobLabel="View Job"
    >
      <Section>
        <Text style={title}>Your job has been accepted – start coordinating!</Text>
        <Text style={body}>{bodyCopy}</Text>
        <Text style={subtext}>Open the job to message the other party and agree on timing.</Text>
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

const subtext = {
  color: "#6b7280",
  fontSize: "13px",
  margin: "0",
};
