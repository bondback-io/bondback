import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { getSupportContactEmail } from "@/lib/support-contact-email";

/** Must be dynamic so the root layout reads auth cookies (logged-in header). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Bond Back Terms of Service — rules for using the Australian bond cleaning marketplace, including payments (GST inclusive), disputes, and Australian Consumer Law.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service · Bond Back",
    description: "Terms for Listers, Cleaners, listings, bidding, escrow payments, and disputes on Bond Back.",
    url: "/terms",
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
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground dark:text-gray-300">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  const supportEmail = getSupportContactEmail();

  return (
    <article className="page-inner mx-auto max-w-3xl space-y-10 pb-12 pt-2 sm:pb-16 sm:pt-4">
      <header className="space-y-2 border-b border-border pb-6 dark:border-gray-800">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-gray-100 md:text-3xl">
          Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          These Terms govern your use of the Bond Back Platform operated by{" "}
          <span className="font-medium text-foreground/80 dark:text-gray-300">Bond Back Pty Ltd</span> in Australia.
          They should be read together with our{" "}
          <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <p className="text-xs text-muted-foreground dark:text-gray-500">
          Last updated: April 2026. All dollar amounts are in <strong>AUD</strong>. Unless we clearly state otherwise,{" "}
          <strong>prices and platform fees shown on the Platform are inclusive of GST</strong>.
        </p>
      </header>

      <div className="space-y-10">
        <Section id="acceptance" title="1. Acceptance of terms">
          <p>
            By creating an account, accessing, or using Bond Back (the <strong>Platform</strong>), you agree to these
            Terms of Service (<strong>Terms</strong>) and our Privacy Policy. If you are using the Platform on behalf
            of a company or trust, you represent that you are authorised to bind that entity.
          </p>
          <p>
            If you do not agree, you must not use the Platform. We may update these Terms from time to time; we will
            take reasonable steps to notify you of material changes where required by the{" "}
            <em>Competition and Consumer Act 2010</em> (Cth) (<strong>CCA</strong>), the <strong>Australian Consumer Law</strong>{" "}
            (<strong>ACL</strong>) as set out in Schedule 2 to the CCA, or applicable <strong>fair trading</strong>{" "}
            legislation. Your continued use after changes become effective constitutes acceptance of the updated Terms,
            except where prohibited by law.
          </p>
        </Section>

        <Section id="accounts" title="2. User accounts and eligibility">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              You must provide accurate, current, and complete registration information and keep it updated.
            </li>
            <li>
              The Platform is intended for users in <strong>Australia</strong>. You must be at least 18 years old and
              capable of entering a binding contract.
            </li>
            <li>
              <strong>Cleaners</strong> offering paid cleaning services through the Platform must maintain a valid{" "}
              <strong>ABN</strong> (Australian Business Number) and comply with applicable tax obligations, including
              GST registration and reporting where required by the <em>A New Tax System (Goods and Services Tax) Act 1999</em>{" "}
              (Cth) (<strong>GST Act</strong>).
            </li>
            <li>
              We may verify information (including ABN status via the Australian Business Register where enabled) and
              suspend or refuse accounts that do not meet eligibility or compliance requirements.
            </li>
          </ul>
        </Section>

        <Section id="responsibilities" title="3. Lister and Cleaner responsibilities and warranties">
          <p>
            <strong>Listers</strong> warrant that they have authority to arrange cleaning for the relevant property,
            that listing information is not misleading under the ACL, and that they will cooperate in good faith with
            Cleaners and with Bond Back for payments, disputes, and safety.
          </p>
          <p>
            <strong>Cleaners</strong> warrant that they hold appropriate registrations and insurances (where required
            by law or advertised on their profile), that they will perform services with due care and skill consistent
            with consumer guarantees under the ACL (where applicable), and that they will comply with workplace health
            and safety obligations and directions lawfully given by the Lister or occupier.
          </p>
          <p>
            Users must not use the Platform for unlawful discrimination, harassment, fraud, or to circumvent fees or
            escrow protections. Circumventing the Platform to avoid payment of agreed fees may result in suspension or
            legal action.
          </p>
        </Section>

        <Section id="listings" title="4. Listing rules and bond cleaning standards">
          <p>
            Listings must accurately describe the property, scope of work, access instructions, and any hazards. Photos
            and descriptions must not be misleading. Listers are responsible for ensuring that cleaning scope aligns
            with bond or end-of-lease expectations they communicate to Cleaners.
          </p>
          <p>
            Cleaners must perform services in a professional manner consistent with their representations and
            reasonable industry standards for bond cleaning in Australia, subject to the agreed scope and any written
            variations agreed through the Platform.
          </p>
          <p>
            We may remove or moderate content that breaches these Terms, applicable law, or our acceptable use policies.
          </p>
        </Section>

        <Section id="payments" title="5. Bidding, Buy Now, and payment process">
          <p>
            The Platform may support auctions, bids, and/or <strong>Buy Now</strong> pricing as made available from
            time to time. All amounts are in <strong>Australian dollars (AUD)</strong>. Unless clearly marked as
            exclusive of GST, <strong>displayed prices and fees are inclusive of GST</strong>.
          </p>
          <p>
            Payments may be processed using <strong>Stripe</strong> (or other processors we nominate), including
            collection, holding, and release of funds consistent with in-product disclosures (<strong>escrow</strong>{" "}
            style flows). You authorise us and our payment partners to debit, credit, and settle amounts in accordance
            with your instructions and these Terms.
          </p>
          <p>
            You agree to comply with Stripe&apos;s terms and any additional payment terms we display at checkout.
            Chargebacks and payment disputes may affect your account and access to the Platform.
          </p>
        </Section>

        <Section id="fees" title="6. Platform fees and commission">
          <p>
            Bond Back may charge <strong>platform fees</strong> or commission on transactions, as disclosed at listing,
            checkout, or in your dashboard. Unless expressly stated otherwise, <strong>such fees are inclusive of GST</strong>{" "}
            for Australian GST-registered supply chains as applicable.
          </p>
          <p>
            Fees may change prospectively with reasonable notice where required under the ACL or applicable fair trading
            laws.
          </p>
        </Section>

        <Section id="disputes" title="7. Dispute resolution and Australian Consumer Law rights">
          <p>
            If a dispute arises between users (for example, scope, quality, or payment timing), you should first use any
            in-Platform dispute or messaging tools we provide and cooperate in good faith.
          </p>
          <p>
            Nothing in these Terms excludes, restricts, or modifies any <strong>consumer guarantee</strong>, right, or
            remedy under the ACL or other non-excludable law. To the extent you are a <strong>consumer</strong> within
            the meaning of the ACL, you may have rights including repair, replacement, refund, or compensation for
            reasonably foreseeable loss, and you may escalate complaints to a state or territory consumer protection
            agency or fair trading office.
          </p>
          <p>
            For disputes with Bond Back concerning our services as platform operator, please contact{" "}
            <a
              href={`mailto:${supportEmail}?subject=Terms%20%2F%20dispute%20enquiry`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {supportEmail}
            </a>
            . If unresolved, you may pursue remedies available under the ACL or fair trading legislation.
          </p>
        </Section>

        <Section id="liability" title="8. Limitation of liability and consumer guarantees">
          <p>
            Subject to the ACL and other non-excludable laws, Bond Back provides the Platform on an &quot;as is&quot; and
            &quot;as available&quot; basis. To the maximum extent permitted by law, we exclude implied warranties that
            can lawfully be excluded.
          </p>
          <p>
            Subject to non-excludable consumer guarantees under the ACL, our aggregate liability to you for loss arising
            from or in connection with the Platform (except liability that cannot be limited under the ACL) may be
            limited to the total platform fees paid by you to us in the twelve (12) months before the claim, or AUD
            $100, whichever is greater, except where a different minimum liability applies under law.
          </p>
          <p>
            We are not liable for indirect, consequential, special, or punitive loss, or loss of profit, revenue, data,
            or goodwill, except where such exclusion is prohibited by the ACL or other law.
          </p>
          <p>
            Users contract directly for cleaning services. Except where we expressly undertake a role (for example, as
            payment facilitator), we are not the principal contractor for on-site cleaning work; however, this does not
            limit non-excludable rights you may have against us as supplier of the Platform service under the ACL.
          </p>
        </Section>

        <Section id="termination" title="9. Termination and suspension">
          <p>
            You may close your account in accordance with in-Platform settings or by contacting support. We may suspend
            or terminate access where reasonably necessary to address fraud, risk, legal compliance, or breaches of
            these Terms.
          </p>
          <p>
            Provisions that by their nature should survive (including intellectual property, liability where permitted,
            governing law, and dispute-related clauses) survive termination.
          </p>
        </Section>

        <Section id="law" title="10. Governing law and jurisdiction">
          <p>
            These Terms are governed by the laws of the <strong>State of Queensland, Australia</strong>. Each party
            irrevocably submits to the non-exclusive jurisdiction of the courts of Queensland and the Commonwealth of
            Australia sitting in Queensland.
          </p>
        </Section>

        <Section id="general" title="11. Severability and entire agreement">
          <p>
            If any provision of these Terms is held invalid or unenforceable, the remaining provisions remain in full
            force and effect. These Terms (with the Privacy Policy and any policies expressly incorporated by reference)
            constitute the entire agreement between you and Bond Back Pty Ltd regarding the subject matter.
          </p>
        </Section>

        <Section id="contact" title="12. Contact">
          <p>
            Questions about these Terms:{" "}
            <a
              href={`mailto:${supportEmail}?subject=Terms%20of%20Service%20enquiry`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {supportEmail}
            </a>
            .
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
