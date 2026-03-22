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

const BRAND_COLOR = "#3b82f6";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";
const SUPPORT_EMAIL = "support@bondback.com";

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
  viewJobLabel = "View Job",
}: EmailLayoutProps) {
  const unsubscribeUrl = `${APP_URL}/settings?tab=notifications`;

  return (
    <Html lang="en">
      <Head />
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>Bond Back</Text>
            <Text style={tagline}>Bond cleaning reverse-auction</Text>
          </Section>

          {/* Preview text (shown in some clients) */}
          {preview && (
            <Text style={previewText}>{preview}</Text>
          )}

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* CTA */}
          {viewJobUrl && (
            <Section style={ctaSection}>
              <Button href={viewJobUrl} style={ctaButton}>
                {viewJobLabel}
              </Button>
            </Section>
          )}

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              <Link href={unsubscribeUrl} style={footerLink}>
                Unsubscribe
              </Link>
              {" · "}
              <Link href={`mailto:${SUPPORT_EMAIL}`} style={footerLink}>
                {SUPPORT_EMAIL}
              </Link>
              {" · "}
              <Link href={APP_URL} style={footerLink}>
                bondback.com
              </Link>
            </Text>
            <Text style={footerCopy}>© Bond Back. All rights reserved.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f3f4f6",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "24px 16px",
  maxWidth: "560px",
};

const header = {
  backgroundColor: BRAND_COLOR,
  borderRadius: "8px 8px 0 0",
  padding: "24px 24px 16px",
  textAlign: "center" as const,
};

const logo = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: "700",
  margin: "0 0 4px 0",
  letterSpacing: "-0.5px",
};

const tagline = {
  color: "rgba(255,255,255,0.9)",
  fontSize: "12px",
  margin: "0",
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

const content = {
  backgroundColor: "#ffffff",
  padding: "24px 24px 20px",
  borderRadius: "0 0 8px 8px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const ctaSection = {
  padding: "20px 24px 24px",
  textAlign: "center" as const,
};

const ctaButton = {
  backgroundColor: BRAND_COLOR,
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  padding: "12px 28px",
  borderRadius: "8px",
  textDecoration: "none",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const footer = {
  padding: "0 24px",
};

const footerText = {
  fontSize: "12px",
  color: "#6b7280",
  margin: "0 0 8px 0",
};

const footerLink = {
  color: BRAND_COLOR,
  textDecoration: "underline",
};

const footerCopy = {
  fontSize: "11px",
  color: "#9ca3af",
  margin: "0",
};
