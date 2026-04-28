import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailDashboardUrl } from "@/lib/marketplace/email-links";

export interface LaunchPromoProgressProps {
  firstName?: string;
  role: "lister" | "cleaner";
  completedCount: number;
  freeJobSlots: number;
}

export const LAUNCH_PROMO_PROGRESS_PREHEADER =
  "🎉 Another 0% fee job in the books — here’s what’s next";

export function LaunchPromoProgress({
  firstName,
  role,
  completedCount,
  freeJobSlots,
}: LaunchPromoProgressProps) {
  const displayName = (firstName ?? "").trim() || "there";
  const dashboardUrl = emailDashboardUrl();
  const slots = Math.max(1, Math.floor(freeJobSlots));
  const done = Math.max(1, Math.min(completedCount, slots));

  return (
    <EmailLayout
      preview={LAUNCH_PROMO_PROGRESS_PREHEADER}
      viewJobUrl={dashboardUrl}
      viewJobLabel="Open your dashboard"
    >
      <Section style={contentSection}>
        <Text style={heading}>🎉 Free job completed! {done} of {slots} with 0% platform fee ✅</Text>
        <Text style={body}>Hi {displayName},</Text>
        <Text style={body}>
          {role === "lister" ? (
            <>
              We&apos;ve just counted another completed job toward your launch promo. You&apos;ve
              now used <strong>{done}</strong> of <strong>{slots}</strong> fee-free completions on
              your account — nice one.
            </>
          ) : (
            <>
              Another job wrapped up — that completion counts toward your launch promo on the
              cleaner side. You&apos;ve now logged <strong>{done}</strong> of{" "}
              <strong>{slots}</strong> fee-free completions.
            </>
          )}
        </Text>
        <Text style={body}>
          {done < slots ? (
            <>
              <strong>Keep the momentum:</strong> your remaining promo slots still have{" "}
              <strong>0% platform fee</strong> while the launch window is open.
            </>
          ) : (
            <>
              You&apos;ve used all launch promo slots on your account — thanks for helping prove
              the marketplace early.
            </>
          )}
        </Text>
        <Text style={trustLine}>
          Questions? Reply to this email or visit Notification settings in your profile anytime.
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
