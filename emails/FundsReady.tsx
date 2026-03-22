import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";

export interface FundsReadyProps {
  jobId: number | string;
  messageText: string;
}

export function FundsReady({ jobId, messageText }: FundsReadyProps) {
  const viewJobUrl = `${APP_URL}/jobs/${jobId}`;

  return (
    <EmailLayout
      preview="Ready to release funds"
      viewJobUrl={viewJobUrl}
      viewJobLabel="View Job"
    >
      <Section>
        <Text style={title}>Ready to release funds</Text>
        <Text style={body}>{messageText}</Text>
        <Text style={subtext}>Review the job and release payment when you&apos;re ready.</Text>
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
