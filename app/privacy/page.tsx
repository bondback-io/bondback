import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSupportContactEmail } from "@/lib/support-contact-email";

/** Must be dynamic so the root layout reads auth cookies (logged-in header). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Bond Back Privacy Policy — how Bond Back Pty Ltd collects, uses, stores, and discloses personal information under the Privacy Act 1988 (Australian Privacy Principles).",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy · Bond Back",
    description:
      "How Bond Back handles personal information for the Australian bond cleaning marketplace.",
    url: "/privacy",
  },
};

const LEGAL_DISCLAIMER =
  "This document is for informational purposes only and does not constitute legal advice. We recommend you seek independent legal advice if required.";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground dark:text-gray-100">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground dark:text-gray-300">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  const privacyEmail = getSupportContactEmail();

  return (
    <article className="page-inner mx-auto max-w-3xl space-y-10 pb-12 pt-2 sm:pb-16 sm:pt-4">
      <header className="space-y-2 border-b border-border pb-6 dark:border-gray-800">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-gray-100 md:text-3xl">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          <span className="font-medium text-foreground/80 dark:text-gray-300">Bond Back Pty Ltd</span>{" "}
          operates the Bond Back online marketplace in Australia. This policy explains how we handle personal
          information in accordance with the <em>Privacy Act 1988</em> (Cth) and the{" "}
          <strong>Australian Privacy Principles</strong> (APPs).
        </p>
        <p className="text-xs text-muted-foreground dark:text-gray-500">
          Last updated: April 2026. Our Australian Business Number (ABN), where applicable, appears on tax invoices
          and official correspondence we issue and may be provided on written request.
        </p>
      </header>

      <div className="space-y-10">
        <Section id="intro" title="1. Introduction">
          <p>
            Bond Back Pty Ltd (<strong>we</strong>, <strong>us</strong>, <strong>our</strong>) operates Bond Back
            (<strong>Platform</strong>), an Australian online marketplace connecting property managers and landlords
            (<strong>Listers</strong>) with ABN-verified professional cleaners (<strong>Cleaners</strong>) for
            end-of-lease and bond-related cleaning services, with a primary focus on the Sunshine Coast, Queensland,
            and availability across Australia where we operate.
          </p>
          <p>
            We are committed to protecting your privacy. This Privacy Policy describes how we collect, hold, use,
            disclose, and otherwise manage <strong>personal information</strong> as defined in the{" "}
            <em>Privacy Act 1988</em> (Cth) (<strong>Privacy Act</strong>), including in line with the APPs.
          </p>
          <p>
            By accessing or using the Platform, you acknowledge that you have read this policy. If you do not agree
            with our practices, you should not use the Platform.
          </p>
        </Section>

        <Section id="collect" title="2. Information we collect">
          <p>We may collect the following kinds of information, depending on how you use the Platform:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Identity and account details:</strong> name, email address, phone number, date of birth (where
              collected), profile photo, roles (Lister/Cleaner), and authentication identifiers (including when you
              sign in via third-party providers such as Google).
            </li>
            <li>
              <strong>Business and tax information (Cleaners):</strong> Australian Business Number (ABN), business
              name, and related details you provide or that we validate against the Australian Business Register where
              enabled.
            </li>
            <li>
              <strong>Property and listing information:</strong> property addresses, suburb, state, postcode, property
              type, descriptions, photos, preferred dates, and other content you upload to listings or jobs.
            </li>
            <li>
              <strong>Job and communications data:</strong> bids, messages, dispute materials, checklists, reviews, and
              metadata associated with jobs and listings.
            </li>
            <li>
              <strong>Payment information:</strong> we use regulated payment service providers (including Stripe) to
              process payments. We do not store your full payment card numbers on our own servers; we may receive
              limited payment metadata (e.g. last four digits, brand, transaction IDs, amounts in AUD). Where we
              issue tax invoices or display fees on the Platform, amounts are generally in <strong>AUD</strong> and,{" "}
              <strong>unless clearly stated otherwise, inclusive of GST</strong> as applicable under the{" "}
              <em>A New Tax System (Goods and Services Tax) Act 1999</em> (Cth).
            </li>
            <li>
              <strong>Technical and usage data:</strong> IP address, device type, browser, approximate location,
              cookies, session tokens, logs, and analytics necessary to secure and improve the Platform.
            </li>
            <li>
              <strong>Support and compliance records:</strong> correspondence with us, complaints, fraud-prevention
              signals, and records we are required to keep under Australian law.
            </li>
          </ul>
        </Section>

        <Section id="use" title="3. How we use your information">
          <p>We use personal information for purposes that are reasonably necessary for our functions and activities, including to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>create and manage accounts, verify identity, and operate the marketplace;</li>
            <li>display listings, bids, profiles, and job-related information to other users as intended by the service;</li>
            <li>process payments, escrow, refunds, platform fees, and GST reporting as applicable;</li>
            <li>communicate with you about your account, jobs, security, and service updates;</li>
            <li>detect, prevent, and investigate fraud, abuse, and unlawful activity;</li>
            <li>comply with legal obligations (including tax, record-keeping, and regulatory requests);</li>
            <li>improve the Platform, conduct analytics in aggregated or de-identified form where appropriate; and</li>
            <li>exercise or defend legal claims.</li>
          </ul>
          <p>
            Where the Privacy Act requires us to use or disclose personal information only with consent, or for a
            permitted general situation or permitted health situation, we will comply with those requirements.
          </p>
        </Section>

        <Section id="sharing" title="4. Sharing of information">
          <p>We may disclose personal information to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Other users:</strong> for example, Listers and Cleaners see information reasonably necessary to
              assess, perform, or administer a job (such as names, usernames, messages, listing/job details, and
              suburb/location as you provide it).
            </li>
            <li>
              <strong>Payment processors:</strong> including <strong>Stripe</strong> (and its affiliates) to process
              payments, payouts, identity verification, and fraud prevention in accordance with their terms and
              privacy policies.
            </li>
            <li>
              <strong>Service providers:</strong> hosting, email, SMS/push notifications, analytics, customer support
              tooling, and security vendors who assist us under contract and only to the extent needed to provide their
              services.
            </li>
            <li>
              <strong>Professional advisers:</strong> lawyers, accountants, and insurers, subject to confidentiality
              obligations.
            </li>
            <li>
              <strong>Law enforcement and regulators:</strong> where required or authorised by Australian law, court
              order, or legitimate regulatory request.
            </li>
            <li>
              <strong>Related bodies corporate or successors:</strong> in connection with a merger, acquisition, or sale
              of assets, subject to applicable law.
            </li>
          </ul>
          <p>We do not sell your personal information to data brokers.</p>
        </Section>

        <Section id="cookies" title="5. Cookies and tracking">
          <p>
            We use cookies and similar technologies (such as local storage) to maintain sessions, remember preferences,
            measure performance, and protect against abuse. Some cookies are essential; others help us understand how
            the Platform is used. Where required by law, we will obtain consent before using non-essential cookies.
          </p>
          <p>You can control cookies through your browser settings; disabling certain cookies may affect functionality.</p>
        </Section>

        <Section id="security" title="6. Data security and storage in Australia">
          <p>
            We implement reasonable technical and organisational measures to protect personal information from misuse,
            interference, loss, unauthorised access, modification, or disclosure. These measures may include encryption in
            transit, access controls, monitoring, and secure development practices.
          </p>
          <p>
            We aim to store and process personal information primarily using infrastructure located in{" "}
            <strong>Australia</strong> where reasonably practicable for our core services. Some subprocessors
            (including global payment and authentication providers) may process limited data outside Australia as
            described in section 9.
          </p>
          <p>No method of transmission over the internet is completely secure; we cannot guarantee absolute security.</p>
        </Section>

        <Section id="rights" title="7. Your rights under the Australian Privacy Principles">
          <p>Subject to the Privacy Act, you may have rights including to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Access</strong> the personal information we hold about you (APP 12);
            </li>
            <li>
              <strong>Correct</strong> personal information that is inaccurate, out-of-date, incomplete, irrelevant, or
              misleading (APP 13); and
            </li>
            <li>
              <strong>Complain</strong> about our handling of your personal information (see section 8).
            </li>
          </ul>
          <p>
            There are exceptions under the Privacy Act (for example, certain commercially sensitive decisions or where
            access would unreasonably affect another person&apos;s privacy). Where we refuse access or correction, we
            will explain our reasons where we are required to do so.
          </p>
        </Section>

        <Section id="access-complain" title="8. How to access, correct, or complain">
          <p>
            <strong>Access and correction:</strong> you may request access to or correction of your personal information
            by contacting our Privacy Officer using the details below. We may ask you to verify your identity before
            responding.
          </p>
          <p>
            <strong>Complaints:</strong> if you believe we have breached the APPs, please contact our Privacy Officer
            first so we can try to resolve the matter. If you are not satisfied with our response, you may complain to
            the <strong>Office of the Australian Information Commissioner</strong> (OAIC) — see{" "}
            <a
              href="https://www.oaic.gov.au/"
              className="font-medium text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              www.oaic.gov.au
            </a>
            .
          </p>
        </Section>

        <Section id="international" title="9. International transfers">
          <p>
            Some of our service providers (including Stripe and certain authentication or email providers) may process
            data in countries outside Australia. Where we disclose personal information overseas, we take reasonable
            steps to ensure the overseas recipient complies with the APPs or that a permitted exception applies under
            the Privacy Act (for example, your informed consent or reasonable necessity for performance of a contract).
          </p>
        </Section>

        <Section id="contact" title="10. Contact our Privacy Officer">
          <p>
            For privacy questions, access/correction requests, or complaints, contact our Privacy Officer at:{" "}
            <a
              href={`mailto:${privacyEmail}?subject=Privacy%20enquiry`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {privacyEmail}
            </a>
            .
          </p>
          <p>
            Bond Back Pty Ltd — Bond cleaning marketplace operating in Australia (including Sunshine Coast, QLD, and
            other regions as we expand).
          </p>
        </Section>
      </div>

      <aside
        className="rounded-lg border border-amber-200/90 bg-amber-50/90 p-4 text-sm leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100"
        role="note"
      >
        <p className="font-semibold text-amber-950 dark:text-amber-50">Important notice</p>
        <p className="mt-2">{LEGAL_DISCLAIMER}</p>
      </aside>
    </article>
  );
}
