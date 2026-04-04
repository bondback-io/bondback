import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailPublicOrigin } from "./email-public-url";

const APP_URL = emailPublicOrigin();

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
      preview={`New message${fromLine} on Job #${jobId}`}
      viewJobUrl={viewJobUrl}
      viewJobLabel="Open chat"
    >
      <Section>
        <Text style={title}>Ping! New message on Job #{jobId} 💬</Text>
        <Text style={body}>
          {fromLine && (
            <>
              <strong>Message{fromLine}:</strong>
              <br />
            </>
          )}
          &ldquo;{messageSnippet}&rdquo;
        </Text>
        <Text style={subtext}>
          Reply in Bond Back so dates, keys, and expectations stay in one thread—much easier than digging
          through SMS.
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
