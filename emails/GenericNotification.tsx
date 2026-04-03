import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bondback.io";

export interface GenericNotificationProps {
  headline: string;
  messageText: string;
  /** Path after APP_URL, e.g. `/jobs/abc-uuid` */
  hrefPath: string;
  ctaLabel?: string;
  preview?: string;
}

export function GenericNotification({
  headline,
  messageText,
  hrefPath,
  ctaLabel = "Open in Bond Back",
  preview,
}: GenericNotificationProps) {
  const url = hrefPath.startsWith("http") ? hrefPath : `${APP_URL}${hrefPath.startsWith("/") ? "" : "/"}${hrefPath}`;
  const bodyCopy = (messageText ?? "").trim() || "You have an update in Bond Back.";

  return (
    <EmailLayout preview={preview ?? headline} viewJobUrl={url} viewJobLabel={ctaLabel}>
      <Section>
        <Text style={title}>{headline}</Text>
        <Text style={body}>{bodyCopy}</Text>
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
  lineHeight: 1.55,
  margin: "0 0 8px 0",
};
