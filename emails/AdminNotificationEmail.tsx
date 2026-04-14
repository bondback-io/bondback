import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import {
  emailAdminDisputesUrl,
  emailAdminListingsUrl,
  emailAdminUrl,
  emailJobUrl,
  emailListingUrl,
  emailPublicOrigin,
} from "@/lib/marketplace/email-links";

export type AdminNotificationEventType = "new_user" | "new_listing" | "dispute_opened";

export type AdminNotificationEmailProps =
  | {
      eventType: "new_user";
      fullName: string;
      email: string;
      roleLabel: string;
      signedUpAtFormatted: string;
      /** Cleaner ABN line; omit or empty for lister-only */
      abnDetailLine?: string;
    }
  | {
      eventType: "new_listing";
      listingTitle: string;
      listingId: string;
      listerName: string;
      listerEmail: string;
      suburb: string;
      postcode: string;
      status: string;
      createdAtFormatted: string;
    }
  | {
      eventType: "dispute_opened";
      jobId: number;
      listingTitle: string | null;
      openedByLabel: string;
      reasonSnippet: string;
      openedAtFormatted: string;
    };

const HEADER_GRADIENT = "linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 55%, #059669 100%)";

function header(): React.ReactNode {
  return (
    <Section style={headerSection}>
      <Text style={logo}>Bond Back</Text>
      <Text style={tagline}>🔔 Admin · internal only</Text>
    </Section>
  );
}

function internalFooter(): React.ReactNode {
  const siteHome = emailPublicOrigin();
  return (
    <Section style={footerSection}>
      <Text style={footerMuted}>
        Internal message for Bond Back administrators. Not sent to customers.
      </Text>
      <Text style={footerMuted}>
        Dates and times use the Bond Back email timezone (default Australia/Sydney). Set{" "}
        <span style={monoInline}>BOND_BACK_EMAIL_TIMEZONE</span> on the server to use another IANA zone
        (e.g. Australia/Perth).
      </Text>
      <Text style={footerMuted}>
        <Link href={emailAdminUrl()} style={link}>
          Open admin
        </Link>
        {" · "}
        <Link href={siteHome} style={link}>
          www.bondback.io
        </Link>
      </Text>
    </Section>
  );
}

/**
 * Unified template for admin-facing system alerts (new user, listing, dispute).
 */
export function AdminNotificationEmail(props: AdminNotificationEmailProps) {
  const preview =
    props.eventType === "new_user"
      ? `New registration: ${props.fullName}`
      : props.eventType === "new_listing"
        ? `New listing: ${props.listingTitle}`
        : `Dispute opened on job #${props.jobId}`;

  if (props.eventType === "new_user") {
    return (
      <Html lang="en">
        <Head />
        <Body style={main}>
          <Container style={container}>
            {header()}
            <Text style={previewText}>{preview}</Text>
            <Text style={heading}>New user registration</Text>
            <Section style={tableSection}>
              <Row label="Full name" value={props.fullName} />
              <Row label="Email" value={props.email} />
              <Row label="Role" value={props.roleLabel} />
              <Row label="Signup date" value={props.signedUpAtFormatted} />
              {props.abnDetailLine ? (
                <Row label="ABN (cleaner)" value={props.abnDetailLine} />
              ) : null}
            </Section>
            {internalFooter()}
          </Container>
        </Body>
      </Html>
    );
  }

  if (props.eventType === "new_listing") {
    return (
      <Html lang="en">
        <Head />
        <Body style={main}>
          <Container style={container}>
            {header()}
            <Text style={previewText}>{preview}</Text>
            <Text style={heading}>New listing created</Text>
            <Section style={tableSection}>
              <Row label="Title" value={props.listingTitle} />
              <Row label="Listing ID" value={props.listingId} />
              <Row label="Lister" value={props.listerName} />
              <Row label="Lister email" value={props.listerEmail} />
              <Row label="Location" value={`${props.suburb} ${props.postcode}`.trim()} />
              <Row label="Status" value={props.status} />
              <Row label="Created" value={props.createdAtFormatted} />
            </Section>
            <Section style={ctaWrap}>
              <Link href={emailListingUrl(props.listingId)} style={ctaLink}>
                View listing
              </Link>
              {" · "}
              <Link href={emailAdminListingsUrl()} style={ctaLink}>
                Admin listings
              </Link>
            </Section>
            {internalFooter()}
          </Container>
        </Body>
      </Html>
    );
  }

  return (
    <Html lang="en">
      <Head />
      <Body style={main}>
        <Container style={container}>
          {header()}
          <Text style={previewText}>{preview}</Text>
          <Text style={heading}>Dispute opened</Text>
          <Section style={tableSection}>
            <Row label="Job ID" value={String(props.jobId)} />
            <Row label="Listing" value={props.listingTitle ?? "—"} />
            <Row label="Opened by" value={props.openedByLabel} />
            <Row label="Opened at" value={props.openedAtFormatted} />
          </Section>
          <Text style={reasonBlock}>
            <strong>Reason (excerpt)</strong>
            <br />
            {props.reasonSnippet}
          </Text>
          <Section style={ctaWrap}>
            <Link href={emailJobUrl(props.jobId)} style={ctaLink}>
              View job
            </Link>
            {" · "}
            <Link href={emailAdminDisputesUrl()} style={ctaLink}>
              Admin disputes
            </Link>
          </Section>
          {internalFooter()}
        </Container>
      </Body>
    </Html>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Text style={row}>
      <span style={rowLabel}>{label}</span>
      <br />
      <span style={rowValue}>{value}</span>
    </Text>
  );
}

const main = {
  backgroundColor: "#e2e8f0",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "24px 16px 32px",
  maxWidth: "560px",
};

const headerSection = {
  backgroundColor: "#1d4ed8",
  backgroundImage: HEADER_GRADIENT,
  borderRadius: "12px",
  padding: "22px 20px 20px",
  marginBottom: "16px",
  textAlign: "center" as const,
};

const logo = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: "800" as const,
  margin: "0 0 6px 0",
  letterSpacing: "-0.03em",
};

const tagline = {
  color: "rgba(255,255,255,0.92)",
  fontSize: "12px",
  margin: "0",
  fontWeight: "600" as const,
  letterSpacing: "0.04em",
};

const previewText = {
  color: "#9ca3af",
  fontSize: "12px",
  margin: "0 0 16px 0",
};

const heading = {
  color: "#111827",
  fontSize: "18px",
  fontWeight: "600" as const,
  margin: "0 0 16px 0",
  lineHeight: 1.35,
};

const tableSection = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  padding: "16px 18px",
  marginBottom: "16px",
};

const row = {
  margin: "0 0 12px 0",
  fontSize: "14px",
  lineHeight: 1.5,
};

const rowLabel = {
  color: "#6b7280",
  fontSize: "11px",
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

const rowValue = {
  color: "#111827",
  fontSize: "14px",
};

const reasonBlock = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: 1.55,
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  padding: "14px 16px",
  margin: "0 0 16px 0",
};

const ctaWrap = {
  margin: "0 0 20px 0",
  fontSize: "13px",
};

const ctaLink = {
  color: "#2563eb",
  textDecoration: "underline" as const,
};

const footerSection = {
  marginTop: "8px",
  paddingTop: "16px",
  borderTop: "1px solid #e5e7eb",
};

const footerMuted = {
  color: "#9ca3af",
  fontSize: "11px",
  margin: "0 0 8px 0",
  lineHeight: 1.5,
};

const link = {
  color: "#6b7280",
  textDecoration: "underline" as const,
};

const monoInline = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "10px",
  color: "#6b7280",
};
