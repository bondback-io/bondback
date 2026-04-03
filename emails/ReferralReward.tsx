import * as React from "react";
import { Section, Text } from "@react-email/components";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bondback.io";

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
  return (
    <Section style={{ fontFamily: "system-ui, sans-serif", padding: "24px" }}>
      <Text style={{ fontSize: 18, fontWeight: 600, color: "#0f172a" }}>
        {isReferred ? "You earned referral credit!" : "Your referral earned you credit!"}
      </Text>
      <Text style={{ fontSize: 15, color: "#334155", lineHeight: 1.5 }}>
        {isReferred ? (
          <>
            Congratulations on completing your first job (Job #{jobId}).{" "}
            <strong>{creditDollars}</strong> has been added to your Bond Back account credit.
          </>
        ) : (
          <>
            Someone you referred just completed their first job (Job #{jobId}).{" "}
            <strong>{creditDollars}</strong> has been added to your account credit as a thank-you.
          </>
        )}
      </Text>
      <Text style={{ fontSize: 14, color: "#64748b" }}>
        Credit applies toward future platform fees where applicable. View your profile:{" "}
        <a href={`${APP_URL}/profile`} style={{ color: "#0284c7" }}>
          {APP_URL}/profile
        </a>
      </Text>
    </Section>
  );
}
