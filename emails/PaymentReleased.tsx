import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";

export interface PaymentReleasedProps {
  jobId: number | string;
  messageText: string;
  /** Optional amount for prominent display, e.g. "$120" */
  amountDisplay?: string;
}

export function PaymentReleased({ jobId, messageText, amountDisplay }: PaymentReleasedProps) {
  const viewJobUrl = `${APP_URL}/jobs/${jobId}`;

  return (
    <EmailLayout
      preview={amountDisplay ? `Payment of ${amountDisplay} released – thank you!` : "Payment released – thank you!"}
      viewJobUrl={viewJobUrl}
      viewJobLabel="View Job"
    >
      <Section>
        {amountDisplay && (
          <Text style={amount}>{amountDisplay} released</Text>
        )}
        <Text style={title}>Payment released – thank you!</Text>
        <Text style={body}>{messageText}</Text>
      </Section>
    </EmailLayout>
  );
}

const amount = {
  color: "#059669",
  fontSize: "22px",
  fontWeight: "700",
  margin: "0 0 8px 0",
};

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
  margin: "0",
};
