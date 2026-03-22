import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";

export interface NewMessageProps {
  jobId: number | string;
  messageSnippet: string;
  senderName?: string;
}

export function NewMessage({ jobId, messageSnippet, senderName }: NewMessageProps) {
  const viewJobUrl = `${APP_URL}/jobs/${jobId}`;
  const fromLine = senderName ? ` from ${senderName}` : "";

  return (
    <EmailLayout
      preview={`New message from ${senderName ?? "someone"} in Job #${jobId}`}
      viewJobUrl={viewJobUrl}
      viewJobLabel="View in Bond Back"
    >
      <Section>
        <Text style={title}>New message from {senderName ?? "someone"} in Job #{jobId}</Text>
        <Text style={body}>
          {fromLine && (
            <>
              <strong>New message{fromLine}:</strong>
              <br />
            </>
          )}
          &ldquo;{messageSnippet}&rdquo;
        </Text>
        <Text style={subtext}>Reply in the job chat to keep everything in one place.</Text>
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
