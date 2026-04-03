import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bondback.io";

export interface PaymentReceiptProps {
  jobId: number | string;
  /** "lister" = you paid; "cleaner" = you received; "refund" = refund to lister */
  variant: "lister" | "cleaner" | "refund";
  amountCents: number;
  feeCents?: number;
  netCents?: number;
  refundCents?: number;
  jobTitle?: string;
  dateIso: string;
  /** Platform ABN for GST/ABN note (optional) */
  platformAbn?: string | null;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PaymentReceipt({
  jobId,
  variant,
  amountCents,
  feeCents = 0,
  netCents = 0,
  refundCents = 0,
  jobTitle,
  dateIso,
  platformAbn,
}: PaymentReceiptProps) {
  const viewJobUrl = `${APP_URL}/jobs/${jobId}`;
  const isRefund = variant === "refund";

  const title = isRefund
    ? "Refund receipt"
    : variant === "lister"
      ? "Payment receipt"
      : "Payout receipt";

  const preview =
    isRefund
      ? `Refund of ${formatCents(refundCents)} for Job #${jobId}`
      : variant === "lister"
        ? `You paid ${formatCents(amountCents)} for Job #${jobId}`
        : `You received ${formatCents(netCents)} for Job #${jobId}`;

  return (
    <EmailLayout
      preview={preview}
      viewJobUrl={viewJobUrl}
      viewJobLabel="View Job"
    >
      <Section>
        <Text style={titleStyle}>{title}</Text>
        <Text style={body}>Job #{jobId}{jobTitle ? ` · ${jobTitle}` : ""}</Text>
        <Text style={body}>Date: {formatDate(dateIso)}</Text>

        {isRefund ? (
          <Text style={amountStyle}>Refund: {formatCents(refundCents)}</Text>
        ) : variant === "lister" ? (
          <>
            <Text style={amountStyle}>Amount paid: {formatCents(amountCents)}</Text>
            {feeCents > 0 && (
              <Text style={body}>Includes platform fee: {formatCents(feeCents)}</Text>
            )}
          </>
        ) : (
          <>
            <Text style={amountStyle}>Amount received: {formatCents(netCents)}</Text>
            {amountCents !== netCents && (
              <Text style={body}>Gross: {formatCents(amountCents)} · Fee deducted: {formatCents(feeCents)}</Text>
            )}
          </>
        )}

        <Text style={gstNote}>
          This receipt is for your records. Amounts are GST inclusive where applicable.
          {platformAbn?.trim() ? ` Bond Back ABN: ${platformAbn.trim()}.` : ""}
        </Text>
      </Section>
    </EmailLayout>
  );
}

const titleStyle = {
  color: "#111827",
  fontSize: "18px",
  fontWeight: "600",
  margin: "0 0 12px 0",
  lineHeight: 1.3,
};

const amountStyle = {
  color: "#059669",
  fontSize: "20px",
  fontWeight: "700",
  margin: "12px 0 8px 0",
};

const body = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: 1.6,
  margin: "0 0 4px 0",
};

const gstNote = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: 1.5,
  margin: "16px 0 0 0",
};
