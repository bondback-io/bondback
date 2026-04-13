"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { VerificationBadges } from "@/components/shared/verification-badges";
import type { BidBidderProfileSummary } from "@/lib/bids/bidder-types";
import { bidderLegalNameFromProfile } from "@/lib/bids/bidder-display";
import { formatLocationWithState } from "@/lib/state-from-postcode";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";
import { cn } from "@/lib/utils";

export type BidderProfilePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: BidBidderProfileSummary | null;
  loading?: boolean;
};

export function BidderProfilePreviewDialog({
  open,
  onOpenChange,
  profile,
  loading = false,
}: BidderProfilePreviewDialogProps) {
  const titleName = bidderLegalNameFromProfile(profile);
  const loc =
    profile?.suburb?.trim() && profile?.postcode != null
      ? formatLocationWithState(profile.suburb, String(profile.postcode))
      : profile?.suburb?.trim() || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(90vh,640px)] max-w-md overflow-y-auto border-border bg-card p-0 dark:border-gray-800 dark:bg-gray-950 sm:max-w-md",
          "data-[state=open]:duration-300"
        )}
      >
        {loading ? (
          <div className="space-y-4 p-6">
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted dark:bg-gray-800" />
            <div className="h-24 w-24 animate-pulse rounded-full bg-muted dark:bg-gray-800" />
            <div className="h-20 animate-pulse rounded bg-muted dark:bg-gray-800" />
          </div>
        ) : profile ? (
          <>
            <DialogHeader className="space-y-1 border-b border-border px-6 pb-4 pt-6 dark:border-gray-800">
              <DialogTitle className="text-left text-xl font-semibold tracking-tight dark:text-gray-100">
                {titleName}
              </DialogTitle>
              {profile.cleaner_username?.trim() ? (
                <p className="text-sm font-medium text-muted-foreground dark:text-gray-400">
                  @{profile.cleaner_username.trim()}
                </p>
              ) : null}
            </DialogHeader>
            <div className="space-y-4 px-6 pb-6 pt-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-border dark:bg-gray-900 dark:ring-gray-700">
                  {profile.profile_photo_url?.trim() ? (
                    <Image
                      src={profile.profile_photo_url.trim()}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="96px"
                      placeholder="blur"
                      blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground dark:text-gray-500">
                      {titleName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {profile.business_name?.trim() ? (
                    <p className="text-sm text-muted-foreground dark:text-gray-400">
                      <span className="font-medium text-foreground dark:text-gray-200">Business: </span>
                      {profile.business_name.trim()}
                    </p>
                  ) : null}
                  {loc ? (
                    <p className="text-sm text-muted-foreground dark:text-gray-400">
                      <span className="font-medium text-foreground dark:text-gray-200">Area: </span>
                      {loc}
                    </p>
                  ) : null}
                  {typeof profile.years_experience === "number" && profile.years_experience >= 0 ? (
                    <p className="text-sm text-muted-foreground dark:text-gray-400">
                      <span className="font-medium text-foreground dark:text-gray-200">Experience: </span>
                      {profile.years_experience} years
                    </p>
                  ) : null}
                  <div className="pt-1">
                    <VerificationBadges badges={profile.verification_badges ?? []} />
                  </div>
                </div>
              </div>
              {profile.bio?.trim() ? (
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-500">
                    Bio
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground dark:text-gray-200">
                    {profile.bio.trim()}
                  </p>
                </div>
              ) : null}
              {Array.isArray(profile.specialties) && profile.specialties.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-500">
                    Specialties
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.specialties.map((s) => (
                      <Badge key={s} variant="secondary" className="font-normal capitalize">
                        {String(s).replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="p-6 text-sm text-muted-foreground dark:text-gray-400">Could not load profile.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
