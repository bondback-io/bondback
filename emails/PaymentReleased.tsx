import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailJobUrl } from "@/lib/marketplace/email-links";

export interface PaymentReleasedProps {
  jobId: number | string;
  messageText: string;
  /** Optional amount for prominent display, e.g. "$120" */
  amountDisplay?: string;
}

export function PaymentReleased({ jobId, messageText, amountDisplay }: PaymentReleasedProps) {
  const viewJobUrl = emailJobUrl(jobId);

  return (
    <EmailLayout
      preview={
        amountDisplay
          ? `${amountDisplay} landed in your account — nice one`
          : "Payment released — thank you for a cracker of a clean"
      }
      viewJobUrl={viewJobUrl}
      viewJobLabel="View job"
    >
      <Section>
        {amountDisplay ? (
          <Text style={amount}>{amountDisplay} released</Text>
        ) : null}
        <Text style={title}>Ka-ching — payment’s on its way 💸</Text>
        <Text style={body}>{messageText}</Text>
      </Section>
    </EmailLayout>
  );
}

const amount = {
  color: "#059669",
  fontSize: "24px",
  fontWeight: "800" as const,
  margin: "0 0 8px 0",
};

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
  margin: "0",
};
