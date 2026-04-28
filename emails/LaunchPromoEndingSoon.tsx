import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailDashboardUrl, emailNewListingUrl } from "@/lib/marketplace/email-links";

export interface LaunchPromoEndingSoonProps {
  firstName?: string;
  freeJobSlotsRemaining: number;
  /** ISO end date for promo window, if any */
  promoEndsAtIso?: string | null;
  normalFeePercent: number;
}

export const LAUNCH_PROMO_ENDING_SOON_PREHEADER =
  "⏳ Launch promo ending soon — use your remaining 0% fee slots";

export function LaunchPromoEndingSoon({
  firstName,
  freeJobSlotsRemaining,
  promoEndsAtIso,
  normalFeePercent,
}: LaunchPromoEndingSoonProps) {
  const displayName = (firstName ?? "").trim() || "there";
  const dashboardUrl = emailDashboardUrl();
  const newListingUrl = emailNewListingUrl();
  const fee =
    typeof normalFeePercent === "number" && Number.isFinite(normalFeePercent)
      ? Math.round(normalFeePercent)
      : 12;

  let endLine: string | null = null;
  if (promoEndsAtIso != null && String(promoEndsAtIso).trim()) {
    const d = new Date(promoEndsAtIso);
    if (Number.isFinite(d.getTime())) {
      endLine = d.toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Australia/Sydney",
      });
    }
  }

  const remaining = Math.max(0, Math.floor(freeJobSlotsRemaining));

  return (
    <EmailLayout
      preview={LAUNCH_PROMO_ENDING_SOON_PREHEADER}
      viewJobUrl={remaining > 0 ? newListingUrl : dashboardUrl}
      viewJobLabel={remaining > 0 ? "Post or finish a job" : "Open your dashboard"}
    >
      <Section style={contentSection}>
        <Text style={heading}>⏳ Your 0% fee launch promo ends soon</Text>
        <Text style={body}>Hi {displayName},</Text>
        <Text style={body}>
          {remaining > 0 ? (
            <>
              You still have <strong>{remaining}</strong> fee-free job{" "}
              {remaining === 1 ? "slot" : "slots"} left on Bond Back. After the launch promo, our
              normal <strong>{fee}%</strong> platform fee applies again on eligible jobs.
            </>
          ) : (
            <>
              The launch promo window is closing. Once it ends, our normal{" "}
              <strong>{fee}%</strong> platform fee applies on eligible jobs.
            </>
          )}
        </Text>
        {endLine ? (
          <Text style={body}>
            <strong>Promo window ends:</strong> {endLine} (Sydney time).
          </Text>
        ) : null}
        <Text style={body}>
          <strong>Tip:</strong> get your next listing live or move an active job through to
          completion so you don&apos;t leave a free slot on the table.
        </Text>
        <Text style={trustLine}>
          We&apos;re cheering you on — fair bids, secure pay, and a smoother handover.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const contentSection = {
  padding: "0 0 8px 0",
};

const heading = {
  color: "#0f172a",
  fontSize: "22px",
  fontWeight: "700" as const,
  margin: "0 0 16px 0",
  lineHeight: 1.3,
};

const body = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.65,
  margin: "0 0 16px 0",
};

const trustLine = {
  color: "#64748b",
  fontSize: "13px",
  margin: "20px 0 0 0",
  lineHeight: 1.5,
  fontWeight: "500" as const,
  borderLeft: "4px solid #10b981",
  paddingLeft: "14px",
};
