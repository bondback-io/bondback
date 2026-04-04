import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/EmailLayout";
import { emailPublicOrigin } from "./email-public-url";

const APP_URL = emailPublicOrigin();

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
  const bodyCopy = (messageText ?? "").trim() || "You’ve got an update waiting on Bond Back.";

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
  color: "#0f172a",
  fontSize: "19px",
  fontWeight: "700" as const,
  margin: "0 0 12px 0",
  lineHeight: 1.35,
};

const body = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: 1.65,
  margin: "0 0 8px 0",
};
