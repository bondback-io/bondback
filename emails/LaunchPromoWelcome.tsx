import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailBrowseJobsUrl, emailNewListingUrl } from "@/lib/marketplace/email-links";

export interface LaunchPromoWelcomeProps {
  firstName?: string;
  role: "lister" | "cleaner" | "both";
  freeJobSlots: number;
}

export const LAUNCH_PROMO_WELCOME_PREHEADER =
  "Your first jobs are fee-free — post a clean or browse work near you";

export function LaunchPromoWelcome({
  firstName,
  role,
  freeJobSlots,
}: LaunchPromoWelcomeProps) {
  const displayName = (firstName ?? "").trim() || "there";
  const browseJobsUrl = emailBrowseJobsUrl();
  const newListingUrl = emailNewListingUrl();
  const slots = Math.max(1, Math.floor(freeJobSlots));

  const primaryUrl = role === "cleaner" ? browseJobsUrl : newListingUrl;
  const primaryLabel =
    role === "cleaner" ? "Browse jobs near you" : "Create your first listing";

  return (
    <EmailLayout
      preview={LAUNCH_PROMO_WELCOME_PREHEADER}
      viewJobUrl={primaryUrl}
      viewJobLabel={primaryLabel}
    >
      <Section style={contentSection}>
        <Text style={heading}>Welcome to Bond Back — your launch promo is on 🎉</Text>
        <Text style={body}>Hi {displayName},</Text>
        <Text style={body}>
          Thanks for joining Bond Back. As part of our launch, your first{" "}
          <strong>{slots}</strong> completed {slots === 1 ? "job" : "jobs"} as a fee-paying party
          carry <strong>0% platform fee</strong> (we waive our cut so you can try the marketplace
          with less friction).
        </Text>
        <Text style={body}>
          {role === "lister" ? (
            <>
              <strong>Your next step:</strong> create a listing for your bond clean, set your
              auction, and let cleaners bid — you stay in control until you accept someone you
              trust.
            </>
          ) : role === "cleaner" ? (
            <>
              <strong>Your next step:</strong> browse open jobs, place competitive bids, and win
              work — escrow helps everyone get paid fairly when the job is done.
            </>
          ) : (
            <>
              <strong>Your next step:</strong> list a clean when you&apos;re moving out, or browse
              jobs when you&apos;re on the tools — both roles are available in one account.
            </>
          )}
        </Text>
        <Text style={trustLine}>
          Promo applies while the launch window is open and until your free job slots are used —
          see your dashboard for live progress.
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
  borderLeft: "4px solid #0ea5e9",
  paddingLeft: "14px",
};
