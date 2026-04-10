import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteUrl } from "@/lib/site";
import type { SuburbSeoRow } from "@/lib/seo/fetch-suburb-for-slug";
import { TOP_BOND_CLEANING_SLUGS } from "@/lib/seo/location-top-slugs";
import { SUNSHINE_COAST_REGION_BOND_CLEANING_SLUGS } from "@/lib/seo/qld-regional-static-seo";
import { buildGeneratedFaqGraphNode, buildLocationFaqGraphNode } from "@/lib/seo/home-json-ld";
import { markdownToHtml } from "@/lib/markdown";
import type { SeoFaqPayload } from "@/lib/seo/seo-content-types";
import {
  resolveBondCleaningPageCached,
} from "@/lib/seo/resolve-bond-cleaning-page";
import { ChevronRight, ClipboardList, Home, LayoutGrid, Sparkles } from "lucide-react";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams(): { slug: string }[] {
  return TOP_BOND_CLEANING_SLUGS.map((slug) => ({ slug }));
}

function locationKeywords(row: SuburbSeoRow, slug: string): string[] {
  const s = row.suburb;
  const base = [
    "bond cleaning",
    "end of lease cleaning",
    "bond back",
    "vacate cleaning",
    `${s} bond cleaning`,
    `bond cleaning ${row.state}`,
    `bond clean ${row.postcode}`,
    `${s} ${row.state} cleaner`,
  ];
  if (
    row.state === "QLD" &&
    SUNSHINE_COAST_REGION_BOND_CLEANING_SLUGS.includes(slug)
  ) {
    return [
      "bond cleaning Sunshine Coast",
      "end of lease cleaning Sunshine Coast",
      "bond clean Sunshine Coast",
      `bond cleaning ${s}`,
      `end of lease cleaning ${s}`,
      ...base,
    ];
  }
  return base;
}

function buildLocationJsonLd(
  row: SuburbSeoRow,
  slug: string,
  siteOrigin: string,
  generatedFaq?: SeoFaqPayload | null
): Record<string, unknown> {
  const pageUrl = `${siteOrigin}/bond-cleaning/${slug}`;
  const orgId = `${siteOrigin}/#bondback`;
  const areaLabel = `${row.suburb}, ${row.state} ${row.postcode}`;

  const localBusiness: Record<string, unknown> = {
    "@type": "LocalBusiness",
    "@id": `${pageUrl}#local`,
    name: `Bond Back — bond cleaning ${row.suburb}`,
    description: `Bond cleaning and end of lease cleaning marketplace serving ${areaLabel}, Australia.`,
    url: pageUrl,
    parentOrganization: { "@id": orgId },
    address: {
      "@type": "PostalAddress",
      addressLocality: row.suburb,
      addressRegion: row.state,
      postalCode: row.postcode,
      addressCountry: "AU",
    },
    areaServed: {
      "@type": "AdministrativeArea",
      name: areaLabel,
    },
    priceRange: "$$",
  };

  const service: Record<string, unknown> = {
    "@type": "Service",
    "@id": `${pageUrl}#service`,
    name: "Bond cleaning & end of lease cleaning",
    serviceType: "Bond cleaning",
    provider: { "@id": orgId },
    areaServed: {
      "@type": "AdministrativeArea",
      name: areaLabel,
    },
    url: pageUrl,
    description: `Post a bond clean or compare cleaner bids in ${row.suburb} — reverse-auction pricing on Bond Back.`,
  };

  const faqNode =
    generatedFaq && generatedFaq.questions?.length
      ? buildGeneratedFaqGraphNode(generatedFaq.questions, pageUrl)
      : buildLocationFaqGraphNode(row, pageUrl);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "Bond Back",
        url: siteOrigin,
        description:
          "Australian marketplace for bond cleaning and end of lease cleaning.",
      },
      localBusiness,
      service,
      faqNode,
    ],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveBondCleaningPageCached(slug);
  if (resolved.status !== "ok") {
    notFound();
  }

  const { row, seo } = resolved;
  const site = getSiteUrl();
  const path = `/bond-cleaning/${slug}`;
  const absoluteUrl = `${site.origin}${path}`;

  const regional =
    row.state === "QLD" &&
    SUNSHINE_COAST_REGION_BOND_CLEANING_SLUGS.includes(slug);
  const area = `${row.suburb}, ${row.state}`;

  const title =
    seo?.meta_title?.trim() ||
    (regional
      ? `Bond cleaning ${row.suburb} & Sunshine Coast QLD | End of lease cleaning`
      : `Bond cleaning ${row.suburb} ${row.state} | Bond Back`);
  const description =
    seo?.meta_description?.trim() ||
    (regional
      ? `Bond cleaning Sunshine Coast & end of lease cleaning in ${row.suburb} (${area}). Compare bids for your bond clean — postcode ${row.postcode}. Vacate cleaning on Bond Back.`
      : `Bond cleaning and end of lease cleaning in ${area}. Compare cleaner bids for your bond back clean — postcode ${row.postcode}. List or bid on Bond Back.`);

  return {
    title,
    description,
    keywords: locationKeywords(row, slug),
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "en_AU",
      url: absoluteUrl,
      siteName: "Bond Back",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

function defaultFaqDisplay(row: SuburbSeoRow): { question: string; answer: string }[] {
  return [
    {
      question: `Where can I find bond cleaning in ${row.suburb}?`,
      answer: `Bond Back lists bond cleaning and end of lease cleaning jobs in ${row.suburb}, ${row.state} — compare cleaner bids before you book.`,
    },
    {
      question: `What is end of lease cleaning in ${row.suburb}?`,
      answer:
        "End of lease cleaning is a detailed clean before your final inspection so you can maximise your bond return. Post your job on Bond Back to receive bids from cleaners in your area.",
    },
  ];
}

export default async function BondCleaningLocationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = await resolveBondCleaningPageCached(slug);
  if (resolved.status === "not_published" || resolved.status === "not_found") {
    notFound();
  }

  const { row, seo } = resolved;
  const site = getSiteUrl();
  const jsonLd = buildLocationJsonLd(row, slug, site.origin, seo?.faq_schema ?? null);
  const display = `${row.suburb}, ${row.state} ${row.postcode}`;
  const landing = seo?.landing;
  const blogPosts = seo?.blog_posts ?? [];
  const faqItems =
    seo?.faq_schema?.questions?.length ? seo.faq_schema.questions : defaultFaqDisplay(row);

  return (
    <article className="page-inner mx-auto max-w-3xl space-y-10 px-4 py-8 sm:space-y-12 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-500">
          Bond cleaning · {display}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-100 sm:text-3xl sm:leading-tight">
          {landing?.heroTitle?.trim() || (
            <>Bond cleaning &amp; end of lease cleaning in {row.suburb}</>
          )}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground dark:text-gray-400 sm:text-lg">
          {landing?.heroSubtitle?.trim() || (
            <>
              Find competitive bond back cleans in {row.suburb} ({row.state} {row.postcode}). Bond Back is
              Australia&apos;s reverse-auction marketplace: listers post end-of-lease jobs, cleaners bid, and
              you choose the price that fits your rental bond clean.
            </>
          )}
        </p>
      </header>

      {/* Body sections (how it works, why Bond Back, etc. from generated content) */}
      {landing?.sections?.length ? (
        <div className="space-y-6">
          {landing.sections.map((sec, i) => (
            <section
              key={`${sec.heading}-${i}`}
              className="space-y-3 rounded-xl border border-border bg-muted/30 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40"
            >
              <h2 className="text-lg font-semibold text-foreground dark:text-gray-100 sm:text-xl">
                {sec.heading}
              </h2>
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(sec.bodyMarkdown) }}
              />
            </section>
          ))}
        </div>
      ) : (
        <section className="space-y-3 rounded-xl border border-border bg-muted/30 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40">
          <h2 className="text-lg font-semibold text-foreground dark:text-gray-100">
            Why search &quot;bond cleaning {row.suburb}&quot; here?
          </h2>
          <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-muted-foreground dark:text-gray-400 sm:text-base">
            <li>Transparent bids instead of opaque quotes — ideal for vacate and bond cleaning.</li>
            <li>Built for Australian renters, owners, and cleaners across {row.state}.</li>
            <li>Secure payments when you&apos;re ready to hire your bond clean.</li>
          </ul>
        </section>
      )}

      {/* Pricing model — reverse auction */}
      <section
        className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-background px-4 py-5 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-gray-950 sm:px-6 sm:py-6"
        aria-labelledby="pricing-heading"
      >
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div className="space-y-2">
            <h2 id="pricing-heading" className="text-lg font-semibold text-foreground dark:text-gray-100">
              Pricing: reverse-auction bids
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
              You post your bond clean once; cleaners compete with bids so you can compare prices for end-of-lease
              cleaning in {row.suburb} before you commit. No obligation until you accept a bid.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/listings/new"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Create a listing
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/jobs"
                className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted dark:border-gray-600 dark:hover:bg-gray-800"
              >
                Browse jobs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Local guides / blog blocks */}
      {blogPosts.length > 0 && (
        <section className="space-y-4" aria-labelledby="guides-heading">
          <h2 id="guides-heading" className="text-lg font-semibold text-foreground dark:text-gray-100 sm:text-xl">
            Local guides
          </h2>
          <div className="space-y-6">
            {blogPosts.map((post) => (
              <article
                key={post.slug}
                id={`guide-${post.slug}`}
                className="rounded-xl border border-border bg-card/40 px-4 py-4 dark:border-gray-700 scroll-mt-24"
              >
                <h3 className="text-base font-semibold text-foreground dark:text-gray-100">{post.title}</h3>
                {post.excerpt ? (
                  <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">{post.excerpt}</p>
                ) : null}
                <div
                  className="prose prose-sm dark:prose-invert mt-3 max-w-none text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(post.bodyMarkdown) }}
                />
              </article>
            ))}
          </div>
        </section>
      )}

      {/* FAQ — visible + duplicated in JSON-LD above */}
      <section className="space-y-3" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-lg font-semibold text-foreground dark:text-gray-100 sm:text-xl">
          Frequently asked questions
        </h2>
        <div className="divide-y divide-border rounded-xl border border-border dark:divide-gray-800 dark:border-gray-800">
          {faqItems.map((item, i) => (
            <details
              key={`${item.question.slice(0, 40)}-${i}`}
              className="group px-4 py-3 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-left text-sm font-medium text-foreground hover:text-emerald-700 dark:text-gray-100 dark:hover:text-emerald-400">
                {item.question}
                <ChevronRight className="h-4 w-4 shrink-0 transition group-open:rotate-90" aria-hidden />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground dark:text-gray-400">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Marketplace links */}
      <section
        className="rounded-xl border border-border bg-muted/20 px-4 py-5 dark:border-gray-800 dark:bg-gray-900/30 sm:px-6"
        aria-labelledby="marketplace-heading"
      >
        <h2 id="marketplace-heading" className="mb-4 text-lg font-semibold text-foreground dark:text-gray-100">
          Explore Bond Back
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li>
            <Link
              href="/jobs"
              className="flex items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium hover:border-border hover:bg-background dark:hover:bg-gray-900"
            >
              <LayoutGrid className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Browse live jobs
            </Link>
          </li>
          <li>
            <Link
              href="/listings/new"
              className="flex items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium hover:border-border hover:bg-background dark:hover:bg-gray-900"
            >
              <ClipboardList className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Post a bond clean
            </Link>
          </li>
          <li>
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium hover:border-border hover:bg-background dark:hover:bg-gray-900"
            >
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Sign up
            </Link>
          </li>
          <li>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium hover:border-border hover:bg-background dark:hover:bg-gray-900"
            >
              <Home className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Marketplace home
            </Link>
          </li>
        </ul>
      </section>
    </article>
  );
}
