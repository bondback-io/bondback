/**
 * Absolute URLs for React Email + server-side notifications.
 * Origin matches `emails/email-public-url` (canonical prod host; localhost in dev when set).
 */
export { emailPublicOrigin, EMAIL_CANONICAL_ORIGIN } from "@/emails/email-public-url";
import { emailPublicOrigin } from "@/emails/email-public-url";
import type { MarketplaceDetailItem } from "@/lib/navigation/listing-or-job-href";
import { detailUrlForCardItem } from "@/lib/navigation/listing-or-job-href";

function origin(): string {
  return emailPublicOrigin().replace(/\/$/, "");
}

export function emailAbsoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin()}${p}`;
}

export function emailJobUrl(jobId: number | string): string {
  return emailAbsoluteUrl(`/jobs/${jobId}`);
}

export function emailListingUrl(listingUuid: string): string {
  return emailAbsoluteUrl(`/listings/${listingUuid}`);
}

/** Same routing as marketplace cards (assigned job → `/jobs/…`, else `/listings/…`). */
export function emailMarketplaceDetailUrl(item: MarketplaceDetailItem): string {
  return emailAbsoluteUrl(detailUrlForCardItem(item));
}

export function emailBrowseJobsUrl(): string {
  return emailAbsoluteUrl("/jobs");
}

/** Browse jobs with distance filter (matches `/jobs` marketplace `radius_km`). */
export function emailBrowseJobsWithRadiusKmUrl(radiusKm: number): string {
  const n = Math.max(1, Math.min(500, Math.round(radiusKm)));
  return emailAbsoluteUrl(`/jobs?radius_km=${n}`);
}

export function emailDashboardUrl(): string {
  return emailAbsoluteUrl("/dashboard");
}

export function emailNewListingUrl(): string {
  return emailAbsoluteUrl("/listings/new");
}

export function emailMyListingsUrl(): string {
  return emailAbsoluteUrl("/my-listings");
}

export function emailEarningsUrl(): string {
  return emailAbsoluteUrl("/earnings");
}

export function emailProfileUrl(): string {
  return emailAbsoluteUrl("/profile");
}

export function emailProfileNotificationsUrl(): string {
  return emailAbsoluteUrl("/profile?tab=preferences");
}

export function emailSupportUrl(): string {
  return emailAbsoluteUrl("/support");
}

export function emailAdminUrl(): string {
  return emailAbsoluteUrl("/admin");
}

export function emailAdminListingsUrl(): string {
  return emailAbsoluteUrl("/admin/listings");
}

export function emailAdminDisputesUrl(): string {
  return emailAbsoluteUrl("/admin/disputes");
}

export function emailAdminJobsUrl(): string {
  return emailAbsoluteUrl("/admin/jobs");
}

export function emailAdminSupportUrl(): string {
  return emailAbsoluteUrl("/admin/support");
}
