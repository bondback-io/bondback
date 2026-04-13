import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { getSiteUrl } from "@/lib/site";
import {
  loadJobByNumericIdForSession,
  loadJobForListingDetailPage,
  loadListingFullForSession,
} from "@/lib/jobs/load-job-for-detail-route";
import { listingNarrativeForSeo } from "@/lib/listing-detail-presenters";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

const META_DESC_MAX = 165;

function plainTextFromListingDescription(raw: string | null | undefined): string {
  const s = String(raw ?? "");
  if (!s.trim()) return "";
  return s.replace(/\s+/g, " ").trim();
}

function truncateMeta(s: string, max: number): string {
  const t = String(s ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function toAbsoluteImageUrl(raw: string | null | undefined, siteOrigin: string): string | undefined {
  const u = String(raw ?? "").trim();
  if (!u) return undefined;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const path = u.startsWith("/") ? u : `/${u}`;
  return new URL(path, siteOrigin).href;
}

function pickListingImage(listing: ListingRow, siteOrigin: string): string | undefined {
  const cover = listing.cover_photo_url;
  const urls = listing.photo_urls;
  const initial = listing.initial_photos;
  const coverStr = String(cover ?? "").trim();
  const first =
    coverStr ||
    (Array.isArray(urls) && urls[0] != null ? String(urls[0]).trim() : "") ||
    (Array.isArray(initial) && initial[0] != null ? String(initial[0]).trim() : "") ||
    null;
  return toAbsoluteImageUrl(first, siteOrigin);
}

function metaPriceCents(listing: ListingRow, job: JobRow | null): number {
  const jobAgreed = job ? (job as { agreed_amount_cents?: number | null }).agreed_amount_cents : null;
  if (job && jobAgreed != null && jobAgreed > 0) return jobAgreed;
  const buy = listing.buy_now_cents;
  if (buy != null && buy > 0) return buy;
  const low = listing.current_lowest_bid_cents;
  if (low != null && low > 0) return low;
  return listing.reserve_cents ?? 0;
}

function formatAudFromCents(cents: number): string {
  if (cents <= 0) return "";
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

export type JobListingCanonical = "jobs" | "listings";

/**
 * Shared dynamic SEO for `/jobs/[id]` and `/listings/[id]`.
 * `routeId` is the URL segment (job id or listing id).
 */
const GENERIC_JOB_LISTING_META: Metadata = {
  title: "Bond Back",
  description:
    "Bond cleaning and end-of-lease cleaning marketplace in Australia — list, bid, and get your bond back.",
  robots: { index: false, follow: true },
};

export async function buildJobListingMetadata(
  routeId: string,
  options: { canonical: JobListingCanonical }
): Promise<Metadata> {
  const site = getSiteUrl();
  const siteOrigin = site.origin;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id;

  let listingId = routeId;
  const numericId = /^\d+$/.test(routeId) ? Number(routeId) : NaN;
  let jobRowMeta: JobRow | null = null;

  if (!Number.isNaN(numericId)) {
    if (options.canonical === "listings") {
      listingId = routeId;
      jobRowMeta = null;
    } else {
      const jl = await loadJobByNumericIdForSession(supabase, numericId, uid);
      if (jl?.listing_id) {
        listingId = String(jl.listing_id);
        jobRowMeta = jl;
      } else {
        return GENERIC_JOB_LISTING_META;
      }
    }
  } else {
    jobRowMeta = await loadJobForListingDetailPage(supabase, routeId, uid);
  }

  const listingRaw = await loadListingFullForSession(supabase, listingId, uid, jobRowMeta);

  if (!listingRaw) {
    return GENERIC_JOB_LISTING_META;
  }

  const listing = listingRaw as ListingRow;

  let jobForPrice: JobRow | null = jobRowMeta;
  if (!jobForPrice) {
    jobForPrice = await loadJobForListingDetailPage(supabase, listingId, uid);
  }

  const title = String(listing.title ?? "").trim() || "Bond clean job";
  const place = [listing.suburb, listing.postcode].filter(Boolean).join(" ");
  const priceCents = metaPriceCents(listing, jobForPrice);
  const priceStr = formatAudFromCents(priceCents);
  const metaDesc = truncateMeta(
    [
      `${title}. Bond cleaning & end of lease cleaning${place ? ` in ${place}` : ""} — Australia.`,
      listing.bedrooms != null ? `${listing.bedrooms} bed` : "",
      listing.bathrooms != null ? `${listing.bathrooms} bath` : "",
      listing.property_type ? `${listing.property_type}` : "",
      priceStr ? `From ${priceStr}.` : "",
      "List, bid & get your bond back on Bond Back.",
    ]
      .filter(Boolean)
      .join(" "),
    META_DESC_MAX
  );

  const canonicalPath =
    options.canonical === "listings"
      ? `/listings/${listing.id}`
      : `/jobs/${routeId}`;

  const ogImage = pickListingImage(listing, siteOrigin);

  const keywords = [
    "bond cleaning",
    "end of lease cleaning",
    "bond back",
    "vacate cleaning",
    listing.suburb && `${listing.suburb} bond cleaning`,
    listing.postcode && `bond clean ${listing.postcode}`,
    listing.bedrooms != null ? `${listing.bedrooms} bedroom bond clean` : "",
    listing.bathrooms != null ? `${listing.bathrooms} bathroom` : "",
    listing.property_type && `${listing.property_type} bond clean`,
    place && `bond cleaning ${place}`,
  ].filter(Boolean) as string[];

  return {
    title,
    description: metaDesc,
    keywords,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "website",
      locale: "en_AU",
      url: canonicalPath,
      siteName: "Bond Back",
      title: `${title} · Bond Back`,
      description: metaDesc,
      ...(ogImage ? { images: [{ url: ogImage, alt: title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Bond Back`,
      description: metaDesc,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

/** JSON-LD JobPosting for bond / end-of-lease cleaning gigs (Australia). */
export function buildJobPostingJsonLd(opts: {
  listing: ListingRow;
  job: JobRow | null;
  canonicalJobUrl: string;
}): Record<string, unknown> {
  const { listing, job, canonicalJobUrl } = opts;
  const title = String(listing.title ?? "").trim() || "Bond clean";
  const body = plainTextFromListingDescription(listingNarrativeForSeo(listing));
  const place = [listing.suburb, listing.postcode].filter(Boolean).join(" ");
  const priceCents = metaPriceCents(listing, job);
  const priceLabel = formatAudFromCents(priceCents);
  const descParts = [
    body.slice(0, 800),
    place && `Location: ${place}.`,
    listing.bedrooms != null && `${listing.bedrooms} bedroom(s)`,
    listing.bathrooms != null && `${listing.bathrooms} bathroom(s)`,
    listing.property_type && `${listing.property_type} property`,
    priceLabel && `From ${priceLabel} (AUD).`,
    "Bond cleaning and end of lease cleaning via Bond Back — Australia.",
  ].filter(Boolean) as string[];
  const description = descParts.join(" ");

  const datePosted =
    job && (job as { created_at?: string }).created_at
      ? (job as { created_at: string }).created_at.slice(0, 10)
      : listing.created_at?.slice(0, 10) ??
        new Date().toISOString().slice(0, 10);

  const validThrough =
    String(listing.status ?? "").toLowerCase() === "live" && listing.end_time
      ? new Date(listing.end_time).toISOString()
      : undefined;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description,
    datePosted,
    employmentType: "OTHER",
    hiringOrganization: {
      "@type": "Organization",
      name: "Bond Back",
      sameAs: getSiteUrl().origin,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: listing.suburb,
        postalCode: listing.postcode,
        addressCountry: "AU",
      },
    },
    url: canonicalJobUrl,
  };

  if (validThrough) schema.validThrough = validThrough;

  if (priceCents > 0) {
    schema.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "AUD",
      value: priceCents / 100,
    };
  }

  return schema;
}
