import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";

export type DigestListingRow = {
  id: string;
  title: string;
  suburb: string;
  /** Estimated pay display, e.g. "$280–$350" */
  estimatedPay: string;
};

export type DailyDigestEmailProps = {
  firstName?: string | null;
  /** Cleaner section — omit if none */
  cleaner?: {
    newJobsInAreaCount: number;
    topListings: DigestListingRow[];
  } | null;
  /** Lister section — omit if none */
  lister?: {
    newBidsCount: number;
    pendingApprovalsCount: number;
    activeJobsCount: number;
  } | null;
  dashboardUrl: string;
  /** Human-readable period e.g. "last 24 hours" */
  periodLabel?: string;
};

function formatMoneyRange(minCents: number, maxCents: number): string {
  const a = Math.round(minCents / 100);
  const b = Math.round(maxCents / 100);
  if (a === b) return `$${a}`;
  return `$${a}–$${b}`;
}

/** Helper for server when building rows from listing cents */
export function estimatedPayFromListingCents(params: {
  reserve_cents: number;
  buy_now_cents: number | null;
  current_lowest_bid_cents: number | null;
}): string {
  const reserve = params.reserve_cents ?? 0;
  const buyNow = params.buy_now_cents;
  const lowest = params.current_lowest_bid_cents ?? reserve;
  const minCents = Math.min(reserve, lowest);
  const maxCents =
    buyNow != null && buyNow > 0 ? Math.max(buyNow, lowest) : Math.max(reserve, lowest);
  return formatMoneyRange(minCents, maxCents);
}

export function DailyDigestEmail({
  firstName,
  cleaner,
  lister,
  dashboardUrl,
  periodLabel = "the last 24 hours",
}: DailyDigestEmailProps) {
  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi,";
  const hasCleaner = cleaner && (cleaner.newJobsInAreaCount > 0 || cleaner.topListings.length > 0);
  const hasLister =
    lister &&
    (lister.newBidsCount > 0 ||
      lister.pendingApprovalsCount > 0 ||
      lister.activeJobsCount > 0);

  return (
    <EmailLayout
      preview={`Your Bond Back summary for ${periodLabel}`}
      viewJobUrl={dashboardUrl}
      viewJobLabel="View in App"
    >
      <Section>
        <Text style={headline}>Your daily digest</Text>
        <Text style={lead}>{greeting}</Text>
        <Text style={body}>
          Here&apos;s what happened on Bond Back during {periodLabel}.
        </Text>
      </Section>

      {hasCleaner && cleaner && (
        <Section style={block}>
          <Text style={sectionTitle}>As a cleaner</Text>
          <Text style={stat}>
            <strong>{cleaner.newJobsInAreaCount}</strong> new job
            {cleaner.newJobsInAreaCount === 1 ? "" : "s"} in your area
          </Text>
          {cleaner.topListings.length > 0 && (
            <>
              <Text style={subhead}>Top listings to explore</Text>
              {cleaner.topListings.map((row) => (
                <Text key={row.id} style={listingLine}>
                  • <strong>{row.title}</strong>
                  <br />
                  <span style={muted}>
                    {row.suburb} · Est. {row.estimatedPay}
                  </span>
                </Text>
              ))}
            </>
          )}
        </Section>
      )}

      {hasLister && lister && (
        <Section style={block}>
          <Text style={sectionTitle}>As a lister</Text>
          <Text style={stat}>
            <strong>{lister.newBidsCount}</strong> new bid
            {lister.newBidsCount === 1 ? "" : "s"} on your listings
          </Text>
          <Text style={stat}>
            <strong>{lister.pendingApprovalsCount}</strong> job
            {lister.pendingApprovalsCount === 1 ? "" : "s"} awaiting your approval
          </Text>
          <Text style={stat}>
            <strong>{lister.activeJobsCount}</strong> active job
            {lister.activeJobsCount === 1 ? "" : "s"} (accepted or in progress)
          </Text>
        </Section>
      )}

      {!hasCleaner && !hasLister && (
        <Section>
          <Text style={body}>No new activity to report for this period.</Text>
        </Section>
      )}
    </EmailLayout>
  );
}

const headline = {
  color: "#0f172a",
  fontSize: "22px",
  fontWeight: "700" as const,
  margin: "0 0 12px 0",
  lineHeight: 1.25,
};

const lead = {
  color: "#334155",
  fontSize: "16px",
  lineHeight: 1.5,
  margin: "0 0 8px 0",
};

const body = {
  color: "#475569",
  fontSize: "15px",
  lineHeight: 1.55,
  margin: "0 0 16px 0",
};

const block = {
  marginTop: "20px",
  marginBottom: "8px",
};

const sectionTitle = {
  color: "#0f172a",
  fontSize: "15px",
  fontWeight: "600" as const,
  margin: "0 0 10px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

const subhead = {
  color: "#64748b",
  fontSize: "13px",
  fontWeight: "600" as const,
  margin: "12px 0 8px 0",
};

const stat = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.5,
  margin: "0 0 6px 0",
};

const listingLine = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: 1.45,
  margin: "0 0 10px 0",
};

const muted = {
  color: "#64748b",
  fontSize: "13px",
};
