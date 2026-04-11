import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailJobUrl } from "@/lib/marketplace/email-links";

export interface JobCreatedProps {
  jobId: number | string;
  messageText: string;
}

export function JobCreated({ jobId, messageText }: JobCreatedProps) {
  const viewJobUrl = emailJobUrl(jobId);
  const bodyCopy =
    (messageText ?? "").trim() ||
    "Your cleaner accepted your job—now’s the time to pay & start so they can see the address and checklist.";

  return (
    <EmailLayout
      preview="Cleaner locked in — next step: pay & start the job"
      viewJobUrl={viewJobUrl}
      viewJobLabel="View job"
    >
      <Section>
        <Text style={title}>You’ve got a cleaner — let’s get this bond clean moving ✨</Text>
        <Text style={body}>{bodyCopy}</Text>
        <Text style={subtext}>
          Use the in-app chat to sort keys, access, and timing—everything stays in one place so no one’s
          playing phone tag.
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
