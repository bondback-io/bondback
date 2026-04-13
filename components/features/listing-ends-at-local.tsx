"use client";

import { useEffect, useState } from "react";
import { formatEndDateTime } from "@/lib/listing-detail-presenters";

/**
 * Renders auction end date/time in the viewer's local timezone. Defers formatting until
 * after mount so we don't SSR in the server's TZ (e.g. UTC on Vercel) and mismatch the user.
 * Aligns with {@link CountdownTimer} which uses the same `parseUtcTimestamp` instant.
 */
export function ListingEndsAtLocal({ endTime }: { endTime: string }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    setLabel(formatEndDateTime(endTime));
  }, [endTime]);

  if (!label) {
    return <span className="inline-block min-h-[1.25em] min-w-[18ch] align-baseline" aria-hidden />;
  }

  return <span>{label}</span>;
}
