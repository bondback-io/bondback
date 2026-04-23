import * as React from "react";
import { Section, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";
import { emailProfileUrl } from "@/lib/marketplace/email-links";

export type ReferralRewardVariant = "referred" | "referrer";

export type ReferralRewardProps = {
  variant: ReferralRewardVariant;
  creditDollars: string;
  jobId: number;
};

/**
 * Email: referral credit after first completed job (payment released).
 */
export function ReferralReward({ variant, creditDollars, jobId }: ReferralRewardProps) {
  const isReferred = variant === "referred";
  const profileUrl = emailProfileUrl();

  return (
    <EmailLayout
      preview={
        isReferred
          ? `You’ve earned ${creditDollars} referral credit — legend`
          : `Your referral just earned you ${creditDollars} credit`
      }
      viewJobUrl={profileUrl}
      viewJobLabel="View your profile"
    >
      <Section>
        <Text style={heading}>
          {isReferred ? "First job done — here’s a little thank-you 🎉" : "Your referral came good — credit’s yours"}
        </Text>
        <Text style={body}>
          {isReferred ? (
            <>
              Massive congrats on wrapping your first job (Job #{jobId}). We&apos;ve added{" "}
              <strong>{creditDollars}</strong> to your Bond Back account credit—use it toward Service Fees
              where applicable.
            </>
          ) : (
            <>
              Someone you referred just finished their first job (Job #{jobId}).{" "}
              <strong>{creditDollars}</strong> is now sitting in your account credit as a cheers for spreading
              the word.
            </>
          )}
        </Text>
        <Text style={finePrint}>
          Credit applies to eligible fees—see your profile for balance and details.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const heading = {
  color: "#0f172a",
  fontSize: "20px",
  fontWeight: "700" as const,
  lineHeight: 1.35,
  margin: "0 0 14px 0",
};

const body = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.65,
  margin: "0 0 12px 0",
};

const finePrint = {
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.5,
  margin: "0",
};
