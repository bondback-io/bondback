import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailPublicOrigin } from "./email-public-url";

const APP_URL = emailPublicOrigin();

export interface SupportTicketConfirmationProps {
  /** First name or friendly fallback */
  greetingName: string;
  /** Human-readable ticket id for display */
  ticketDisplayId: string;
  /** User-submitted ticket subject */
  ticketSubject: string;
}

/**
 * Transactional email sent when a user submits a support ticket (matches EmailLayout branding).
 */
export function SupportTicketConfirmation({
  greetingName,
  ticketDisplayId,
  ticketSubject,
}: SupportTicketConfirmationProps) {
  const supportUrl = `${APP_URL}/support`;
  const preview = `Ticket #${ticketDisplayId} — we’ve got your message`;

  return (
    <EmailLayout preview={preview} viewJobUrl={supportUrl} viewJobLabel="View your ticket">
      <Section>
        <Text style={heading}>We’ve got your message ✓</Text>
        <Text style={body}>Hi {greetingName},</Text>
        <Text style={body}>
          Thanks for reaching out — your support request is logged and the team will take a look. If anything
          else comes to mind, reply to this email and it&apos;ll land on the same ticket.
        </Text>
      </Section>

      <Section style={detailBox}>
        <Text style={detailLabel}>Ticket</Text>
        <Text style={detailStrong}>#{ticketDisplayId}</Text>
        <Text style={detailLabel}>Subject</Text>
        <Text style={detailSubject}>{ticketSubject || "—"}</Text>
      </Section>

      <Section>
        <Text style={muted}>
          We typically reply within 24 hours (AEST business days). For account security, we may ask you to
          confirm a few details in the app.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const heading = {
  color: "#0f172a",
  fontSize: "22px",
  fontWeight: "700" as const,
  margin: "0 0 14px 0",
  lineHeight: 1.3,
};

const body = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.65,
  margin: "0 0 14px 0",
};

const detailBox = {
  backgroundColor: "#f8fafc",
  borderLeft: "4px solid #059669",
  borderRadius: "0 8px 8px 0",
  padding: "16px 18px",
  margin: "8px 0 18px 0",
};

const detailLabel = {
  color: "#64748b",
  fontSize: "11px",
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  margin: "0 0 4px 0",
};

const detailStrong = {
  color: "#0f172a",
  fontSize: "17px",
  fontWeight: "700" as const,
  margin: "0 0 12px 0",
};

const detailSubject = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.5,
  margin: "0",
};

const muted = {
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.55,
  margin: "0",
};
