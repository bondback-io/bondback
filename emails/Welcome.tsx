import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailDashboardUrl } from "@/lib/marketplace/email-links";

export interface WelcomeProps {
  /** First name or display name */
  firstName?: string;
  /** lister | cleaner | both */
  role: "lister" | "cleaner" | "both";
}

/** Preheader text (hidden, shown in inbox preview by some clients) */
export const WELCOME_PREHEADER =
  "Fair bids, secure pay, and one less thing to worry about before handover";

export function Welcome({ firstName, role }: WelcomeProps) {
  const dashboardUrl = emailDashboardUrl();
  const displayName = (firstName ?? "").trim() || "there";
  const greeting = `Hi ${displayName},`;

  const roleBenefits =
    role === "lister"
      ? "Post your bond clean, watch cleaners compete on price, and pick someone you trust—without the ring-around."
      : role === "cleaner"
        ? "Browse local bond-clean jobs, bid with confidence, and get paid when the work’s done—escrow keeps everyone honest."
        : "List a clean when you’re moving out, or pick up jobs when you’re on the tools—both roles live in one account.";

  return (
    <EmailLayout
      preview={WELCOME_PREHEADER}
      viewJobUrl={dashboardUrl}
      viewJobLabel="Open your dashboard"
    >
      <Section style={contentSection}>
        <Text style={heading}>You’re in — welcome to Bond Back 🇦🇺</Text>
        <Text style={body}>{greeting}</Text>
        <Text style={body}>
          Thanks for joining Australia&apos;s bond-clean marketplace. We built this because end-of-lease
          stress is real—and your bond shouldn&apos;t depend on luck (or a dodgy flyer).
        </Text>
        <Text style={body}>
          <strong>What you can do:</strong> {roleBenefits}
        </Text>
        <Text style={trustLine}>
          Secure payments · Escrow protection · Disputes handled fairly — no worries, we&apos;re not here to
          make moving harder, we&apos;re here to help you cross the finish line.
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
