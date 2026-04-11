import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import {
  emailProfileNotificationsUrl,
  emailPublicOrigin,
} from "@/lib/marketplace/email-links";

const BRAND_BLUE = "#1d4ed8";
const BRAND_SKY = "#0ea5e9";
const BRAND_EMERALD = "#059669";
const BRAND_INK = "#0f172a";
const BRAND_MUTED = "#64748b";

export interface EmailLayoutProps {
  children: React.ReactNode;
  preview?: string;
  viewJobUrl?: string;
  viewJobLabel?: string;
}

export function EmailLayout({
  children,
  preview,
  viewJobUrl,
  viewJobLabel = "Open Bond Back",
}: EmailLayoutProps) {
  const APP_URL = emailPublicOrigin();
  const unsubscribeUrl = emailProfileNotificationsUrl();
  const SUPPORT_EMAIL = "support@bondback.io";

  return (
    <Html lang="en-AU">
      <Head />
      <Body style={main}>
        <Container style={outer}>
          <Section style={headerBand}>
            <Text style={logo}>Bond Back</Text>
            <Text style={tagline}>Bond cleans · Fair bids · Australia</Text>
          </Section>

          {preview ? <Text style={previewText}>{preview}</Text> : null}

          <Section style={card}>
            {children}
          </Section>

          {viewJobUrl ? (
            <Section style={ctaSection}>
              <Button href={viewJobUrl} style={ctaButton}>
                {viewJobLabel}
              </Button>
            </Section>
          ) : null}

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerLinks}>
              <Link href={unsubscribeUrl} style={footerLink}>
                Notification settings
              </Link>
              {" · "}
              <Link href={`mailto:${SUPPORT_EMAIL}`} style={footerLink}>
                {SUPPORT_EMAIL}
              </Link>
              {" · "}
              <Link href={APP_URL} style={footerLink}>
                www.bondback.io
              </Link>
            </Text>
            <Text style={footerCopy}>© {new Date().getFullYear()} Bond Back. Made for renters & cleaners across Australia.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#e2e8f0",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  margin: 0,
  padding: "24px 12px",
};

const outer = {
  margin: "0 auto",
  maxWidth: "580px",
};

const headerBand = {
  backgroundColor: BRAND_BLUE,
  backgroundImage: `linear-gradient(135deg, ${BRAND_BLUE} 0%, ${BRAND_SKY} 55%, ${BRAND_EMERALD} 100%)`,
  borderRadius: "12px 12px 0 0",
  padding: "28px 24px 22px",
  textAlign: "center" as const,
};

const logo = {
  color: "#ffffff",
  fontSize: "26px",
  fontWeight: "800" as const,
  margin: "0 0 6px 0",
  letterSpacing: "-0.03em",
};

const tagline = {
  color: "rgba(255,255,255,0.92)",
  fontSize: "13px",
  margin: "0",
  fontWeight: "500" as const,
};

const previewText = {
  display: "none",
  fontSize: "1px",
  lineHeight: "1px",
  maxHeight: "0",
  maxWidth: "0",
  opacity: 0,
  overflow: "hidden",
};

const card = {
  backgroundColor: "#ffffff",
  borderRadius: "0 0 12px 12px",
  padding: "28px 24px 24px",
  boxShadow: "0 4px 24px rgba(15, 23, 42, 0.08)",
};

const ctaSection = {
  padding: "8px 8px 0",
  textAlign: "center" as const,
};

const ctaButton = {
  backgroundColor: BRAND_EMERALD,
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "700" as const,
  padding: "14px 32px",
  borderRadius: "999px",
  textDecoration: "none",
  boxShadow: "0 4px 14px rgba(5, 150, 105, 0.35)",
};

const hr = {
  borderColor: "#cbd5e1",
  borderWidth: "0 0 1px 0",
  borderStyle: "solid",
  margin: "20px 0 16px",
};

const footer = {
  padding: "0 8px 8px",
  textAlign: "center" as const,
};

const footerLinks = {
  fontSize: "12px",
  color: BRAND_MUTED,
  margin: "0 0 8px 0",
  lineHeight: 1.5,
};

const footerLink = {
  color: BRAND_BLUE,
  textDecoration: "underline",
};

const footerCopy = {
  fontSize: "11px",
  color: "#94a3b8",
  margin: "0",
  lineHeight: 1.45,
};

export const emailTypography = {
  headline: {
    color: BRAND_INK,
    fontSize: "22px",
    fontWeight: "700" as const,
    margin: "0 0 14px 0",
    lineHeight: 1.25,
  },
  title: {
    color: BRAND_INK,
    fontSize: "18px",
    fontWeight: "600" as const,
    margin: "0 0 12px 0",
    lineHeight: 1.35,
  },
  body: {
    color: "#334155",
    fontSize: "15px",
    lineHeight: 1.65,
    margin: "0 0 16px 0",
  },
  subtext: {
    color: BRAND_MUTED,
    fontSize: "13px",
    lineHeight: 1.5,
    margin: "0",
  },
};
