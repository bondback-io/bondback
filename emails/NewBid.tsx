import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bondback.io";

export interface NewBidProps {
  listingId?: number | string;
  messageText?: string;
}

export function NewBid({ listingId, messageText }: NewBidProps) {
  const viewUrl = listingId ? `${APP_URL}/listings/${listingId}` : APP_URL;

  return (
    <EmailLayout
      preview="New bid on your listing – Bond Back"
      viewJobUrl={viewUrl}
      viewJobLabel="View listing"
    >
      <Section>
        <Text style={title}>New bid on your listing</Text>
        <Text style={body}>
          {messageText || "A cleaner has placed a bid on your bond clean listing. View the listing to see the bid and accept or wait for more."}
        </Text>
        <Text style={subtext}>You can view and manage bids from your listing page.</Text>
      </Section>
    </EmailLayout>
  );
}

const title = {
  color: "#111827",
  fontSize: "18px",
  fontWeight: "600",
  margin: "0 0 12px 0",
  lineHeight: 1.3,
};

const body = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: 1.6,
  margin: "0 0 16px 0",
};

const subtext = {
  color: "#6b7280",
  fontSize: "13px",
  margin: "0",
};
