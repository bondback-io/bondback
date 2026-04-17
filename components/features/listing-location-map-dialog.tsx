"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchSuburbLatLonForListingMap } from "@/lib/actions/find-jobs-detail";

const ListingLocationMapPreview = dynamic(
  () =>
    import("./listing-location-map-preview").then((m) => m.ListingLocationMapPreview),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(50vh,340px)] w-full items-center justify-center rounded-lg border border-border bg-muted/40 dark:border-gray-700 dark:bg-gray-900/50">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    ),
  }
);

export type ListingLocationMapDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full line shown in the dialog (e.g. suburb + state + postcode). */
  addressLabel: string;
  postcode: string;
  suburb: string;
};

export function ListingLocationMapDialog({
  open,
  onOpenChange,
  addressLabel,
  postcode,
  suburb,
}: ListingLocationMapDialogProps) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");

  useEffect(() => {
    if (!open) {
      setCoords(null);
      setPhase("idle");
      return;
    }
    let cancelled = false;
    setPhase("loading");
    setCoords(null);
    void fetchSuburbLatLonForListingMap(postcode, suburb).then((ll) => {
      if (cancelled) return;
      if (ll) {
        setCoords(ll);
        setPhase("ready");
      } else {
        setPhase("unavailable");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, postcode, suburb]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Location</DialogTitle>
          <DialogDescription className="text-left text-foreground/90 dark:text-gray-200">
            {addressLabel}
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground dark:text-gray-500">
          Map shows the approximate suburb area (not the exact street address).
        </p>
        {phase === "loading" || phase === "idle" ? (
          <div className="flex h-[min(50vh,340px)] w-full items-center justify-center rounded-lg border border-border bg-muted/40 dark:border-gray-700 dark:bg-gray-900/50">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : phase === "unavailable" ? (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground dark:border-gray-700">
            We couldn&apos;t load a map for this location.
          </p>
        ) : coords ? (
          <ListingLocationMapPreview lat={coords.lat} lon={coords.lon} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
