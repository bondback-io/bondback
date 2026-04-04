import { Button, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const BRAND_EMERALD = "#059669";
const BRAND_BLUE = "#1d4ed8";

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
    <EmailLayout
      preview={`You’re front of the queue on “${jobTitle}” — tap to confirm`}
    >
      <Section>
        <Text style={headline}>🎯 You&apos;re picked — lock it in?</Text>
        <Text style={lead}>
          The lister has chosen your bid early (nice one). Confirm to accept the job and get cracking — or
          decline if the timing&apos;s not right. No stress either way.
        </Text>
      </Section>

      <Section style={detailBox}>
        <Text style={detailTitle}>Job snapshot</Text>
        <Text style={detailRow}>
          <strong>Job:</strong> {jobTitle}
        </Text>
        <Text style={detailRow}>
          <strong>Where:</strong> {addressLine}
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
          Confirm &amp; accept job
        </Button>
      </Section>
      <Section style={btnRow}>
        <Button href={declineUrl} style={btnSecondary}>
          Decline this offer
        </Button>
      </Section>

      <Section>
        <Text style={note}>
          <strong>Heads up:</strong> This offer expires in {expiresSummary} if you don&apos;t confirm — fair
          dinkum, jump on it when you can.
        </Text>
        <Text style={footerHint}>
          Buttons playing up? Paste into your browser:
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
  fontSize: "22px",
  fontWeight: "700" as const,
  margin: "0 0 12px 0",
  lineHeight: 1.3,
};

const lead = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.65,
  margin: "0 0 20px 0",
};

const detailBox = {
  backgroundColor: "#f8fafc",
  borderLeft: `4px solid ${BRAND_EMERALD}`,
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
  lineHeight: 1.55,
  margin: "0 0 6px 0",
};

const btnRow = {
  textAlign: "center" as const,
  marginBottom: "12px",
};

const btnPrimary = {
  backgroundColor: BRAND_EMERALD,
  borderRadius: "999px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 28px",
  boxShadow: "0 4px 14px rgba(5, 150, 105, 0.35)",
};

const btnSecondary = {
  backgroundColor: "#ffffff",
  border: `2px solid ${BRAND_BLUE}`,
  borderRadius: "999px",
  color: BRAND_BLUE,
  fontSize: "15px",
  fontWeight: "600" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 26px",
};

const note = {
  color: "#475569",
  fontSize: "14px",
  lineHeight: 1.6,
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
