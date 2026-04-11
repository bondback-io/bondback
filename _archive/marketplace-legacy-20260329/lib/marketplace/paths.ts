/**
 * Relative in-app paths for listings vs jobs — keep in sync with `lib/navigation/listing-or-job-href`.
 */

export function jobDetailPath(jobId: number | string): string {
  return `/jobs/${jobId}`;
}

export function listingDetailPath(listingUuid: string): string {
  return `/listings/${listingUuid}`;
}
