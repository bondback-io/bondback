import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteUrl } from "@/lib/site";
import type { SuburbSeoRow } from "@/lib/seo/fetch-suburb-for-slug";
import { fetchSuburbForSlug } from "@/lib/seo/fetch-suburb-for-slug";
import { TOP_BOND_CLEANING_SLUGS } from "@/lib/seo/location-top-slugs";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams(): { slug: string }[] {
  return TOP_BOND_CLEANING_SLUGS.map((slug) => ({ slug }));
}

function locationKeywords(row: SuburbSeoRow): string[] {
  const s = row.suburb;
  return [
    "bond cleaning",
    "end of lease cleaning",
    "bond back",
    "vacate cleaning",
    `${s} bond cleaning`,
    `bond cleaning ${row.state}`,
    `bond clean ${row.postcode}`,
    `${s} ${row.state} cleaner`,
  ];
}

function buildLocationJsonLd(
  row: SuburbSeoRow,
  slug: string,
  siteOrigin: string
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
    ],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const row = await fetchSuburbForSlug(slug);
  if (!row) notFound();
  const area = `${row.suburb}, ${row.state}`;
  const title = `Bond cleaning ${row.suburb} ${row.state} | Bond Back`;
  const description = `Bond cleaning and end of lease cleaning in ${area}. Compare cleaner bids for your bond back clean — postcode ${row.postcode}. List or bid on Bond Back.`;
  const canonical = `/bond-cleaning/${slug}`;
  return {
    title,
    description,
    keywords: locationKeywords(row),
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "en_AU",
      url: canonical,
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

export default async function BondCleaningLocationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await fetchSuburbForSlug(slug);
  if (!row) notFound();

  const site = getSiteUrl();
  const jsonLd = buildLocationJsonLd(row, slug, site.origin);
  const display = `${row.suburb}, ${row.state} ${row.postcode}`;

  return (
    <article className="page-inner mx-auto max-w-3xl space-y-6 px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-500">
          Bond cleaning · {display}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-100 sm:text-3xl">
          Bond cleaning &amp; end of lease cleaning in {row.suburb}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground dark:text-gray-400">
          Find competitive bond back cleans in {row.suburb} ({row.state} {row.postcode}). Bond Back is
          Australia&apos;s reverse-auction marketplace: listers post end-of-lease jobs, cleaners bid, and
          you choose the price that fits your rental bond clean.
        </p>
      </header>
      <section className="space-y-3 rounded-xl border border-border bg-muted/30 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40">
        <h2 className="text-lg font-semibold text-foreground dark:text-gray-100">
          Why search &quot;bond cleaning {row.suburb}&quot; here?
        </h2>
        <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
          <li>Transparent bids instead of opaque quotes — ideal for vacate and bond cleaning.</li>
          <li>Built for Australian renters, owners, and cleaners across {row.state}.</li>
          <li>Secure payments when you&apos;re ready to hire your bond clean.</li>
        </ul>
      </section>
      <section className="flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Get started
        </Link>
        <Link
          href="/listings/new"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
        >
          Post a bond clean
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to home
        </Link>
      </section>
    </article>
  );
}
