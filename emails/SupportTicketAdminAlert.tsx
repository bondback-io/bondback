import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailAdminSupportUrl } from "@/lib/marketplace/email-links";

export interface SupportTicketAdminAlertProps {
  ticketDisplayId: string;
  category: string;
  ticketSubject: string;
  descriptionPreview: string;
  contactEmail: string | null;
  jobId: number | null;
  listingId: string | null;
}

/**
 * Sent to every admin when a user submits a support ticket (operational alert).
 */
export function SupportTicketAdminAlert({
  ticketDisplayId,
  category,
  ticketSubject,
  descriptionPreview,
  contactEmail,
  jobId,
  listingId,
}: SupportTicketAdminAlertProps) {
  const adminUrl = emailAdminSupportUrl();
  const preview = `New support ticket #${ticketDisplayId}`;

  return (
    <EmailLayout preview={preview} viewJobUrl={adminUrl} viewJobLabel="Open admin support">
      <Section>
        <Text style={heading}>New support ticket</Text>
        <Text style={body}>
          Someone submitted a ticket on Bond Back. Review it in the admin console.
        </Text>
      </Section>

      <Section style={detailBox}>
        <Text style={detailLabel}>Ticket</Text>
        <Text style={detailStrong}>#{ticketDisplayId}</Text>
        <Text style={detailLabel}>Category</Text>
        <Text style={detailValue}>{category || "—"}</Text>
        <Text style={detailLabel}>Subject</Text>
        <Text style={detailValue}>{ticketSubject || "—"}</Text>
        {contactEmail ? (
          <>
            <Text style={detailLabel}>Contact email</Text>
            <Text style={detailValue}>{contactEmail}</Text>
          </>
        ) : null}
        {jobId != null && !Number.isNaN(jobId) ? (
          <>
            <Text style={detailLabel}>Job ID</Text>
            <Text style={detailValue}>{String(jobId)}</Text>
          </>
        ) : null}
        {listingId ? (
          <>
            <Text style={detailLabel}>Listing ID</Text>
            <Text style={mono}>{listingId}</Text>
          </>
        ) : null}
        <Text style={detailLabel}>Description</Text>
        <Text style={previewBody}>{descriptionPreview || "—"}</Text>
      </Section>

      <Section>
        <Text style={muted}>
          You are receiving this because your account is marked as an administrator.
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
  borderLeft: "4px solid #1d4ed8",
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
  margin: "12px 0 4px 0",
};

const detailStrong = {
  color: "#0f172a",
  fontSize: "17px",
  fontWeight: "700" as const,
  margin: "0 0 0 0",
};

const detailValue = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.5,
  margin: "0",
};

const mono = {
  color: "#334155",
  fontSize: "13px",
  fontFamily: "ui-monospace, monospace",
  lineHeight: 1.5,
  margin: "0",
  wordBreak: "break-all" as const,
};

const previewBody = {
  color: "#475569",
  fontSize: "14px",
  lineHeight: 1.6,
  margin: "0",
  whiteSpace: "pre-wrap" as const,
};

const muted = {
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.55,
  margin: "0",
};
