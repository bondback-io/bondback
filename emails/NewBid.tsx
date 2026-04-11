import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailListingUrl, emailPublicOrigin } from "@/lib/marketplace/email-links";

export interface NewBidProps {
  listingId?: number | string;
  messageText?: string;
}

export function NewBid({ listingId, messageText }: NewBidProps) {
  const viewUrl = listingId ? emailListingUrl(String(listingId)) : emailPublicOrigin();

  return (
    <EmailLayout
      preview="Someone just bid on your bond clean — have a peek"
      viewJobUrl={viewUrl}
      viewJobLabel="Review bids"
    >
      <Section>
        <Text style={title}>Fresh bid on your listing 🎯</Text>
        <Text style={body}>
          {messageText ||
            "A cleaner has placed a bid on your bond clean. Compare their offer, check their profile, and reply in-app when you’re ready."}
        </Text>
        <Text style={subtext}>
          The reverse auction means lower bids win—so take your time, or jump in if the price already feels
          fair dinkum.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const title = {
  color: "#0f172a",
  fontSize: "20px",
  fontWeight: "700" as const,
  margin: "0 0 12px 0",
  lineHeight: 1.3,
};

const body = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.65,
  margin: "0 0 16px 0",
};

const subtext = {
  color: "#64748b",
  fontSize: "13px",
  margin: "0",
  lineHeight: 1.5,
};
