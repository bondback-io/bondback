import { Button, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

export type EarlyBidConfirmationEmailProps = {
  jobTitle: string;
  /** e.g. Suburb, Postcode */
  addressLine: string;
  bidAmountDisplay: string;
  propertySizeLine: string;
  confirmUrl: string;
  declineUrl: string;
  expiresSummary: string;
};

export function EarlyBidConfirmationEmail({
  jobTitle,
  addressLine,
  bidAmountDisplay,
  propertySizeLine,
  confirmUrl,
  declineUrl,
  expiresSummary,
}: EarlyBidConfirmationEmailProps) {
  return (
    <EmailLayout preview={`Your bid on ${jobTitle} was selected — please confirm`}>
      <Section>
        <Text style={headline}>Your bid has been selected — please confirm</Text>
        <Text style={lead}>
          The lister has chosen your bid early. Please confirm to win the job and start working.
        </Text>
      </Section>

      <Section style={detailBox}>
        <Text style={detailTitle}>Job details</Text>
        <Text style={detailRow}>
          <strong>Title:</strong> {jobTitle}
        </Text>
        <Text style={detailRow}>
          <strong>Location:</strong> {addressLine}
        </Text>
        <Text style={detailRow}>
          <strong>Your bid:</strong> {bidAmountDisplay}
        </Text>
        <Text style={detailRow}>
          <strong>Property:</strong> {propertySizeLine}
        </Text>
      </Section>

      <Section style={btnRow}>
        <Button href={confirmUrl} style={btnPrimary}>
          Confirm &amp; Accept Job
        </Button>
      </Section>
      <Section style={btnRow}>
        <Button href={declineUrl} style={btnSecondary}>
          Decline this offer
        </Button>
      </Section>

      <Section>
        <Text style={note}>
          <strong>Note:</strong> This offer will expire in {expiresSummary} if not confirmed.
        </Text>
        <Text style={footerHint}>
          If the buttons don&apos;t work, copy and paste these links into your browser:
          <br />
          <span style={mono}>Confirm: {confirmUrl}</span>
          <br />
          <span style={mono}>Decline: {declineUrl}</span>
        </Text>
      </Section>
    </EmailLayout>
  );
}

const headline = {
  color: "#0f172a",
  fontSize: "20px",
  fontWeight: "700" as const,
  margin: "0 0 12px 0",
  lineHeight: 1.3,
};

const lead = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.55,
  margin: "0 0 20px 0",
};

const detailBox = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  padding: "16px 18px",
  marginBottom: "24px",
};

const detailTitle = {
  color: "#0f172a",
  fontSize: "13px",
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0 0 10px 0",
};

const detailRow = {
  color: "#475569",
  fontSize: "14px",
  lineHeight: 1.5,
  margin: "0 0 6px 0",
};

const btnRow = {
  textAlign: "center" as const,
  marginBottom: "12px",
};

const btnPrimary = {
  backgroundColor: "#2563eb",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 28px",
};

const btnSecondary = {
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  color: "#334155",
  fontSize: "15px",
  fontWeight: "600" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 28px",
};

const note = {
  color: "#475569",
  fontSize: "14px",
  lineHeight: 1.55,
  margin: "20px 0 12px 0",
};

const footerHint = {
  color: "#94a3b8",
  fontSize: "11px",
  lineHeight: 1.45,
  margin: "0",
  wordBreak: "break-all" as const,
};

const mono = {
  fontFamily: "ui-monospace, monospace",
  fontSize: "10px",
};
