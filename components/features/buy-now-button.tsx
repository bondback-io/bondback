"use client";

import { useState } from "react";
import { secureJobAtPrice } from "@/lib/actions/jobs";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/listings";
import { ConnectRequiredModal } from "@/components/features/connect-required-modal";
import { cn } from "@/lib/utils";

export type BuyNowButtonProps = {
  listingId: string;
  buyNowCents: number;
  disabled?: boolean;
  currentUserId?: string | null;
  /** Optional classes for the trigger button (e.g. mobile min-height). */
  className?: string;
};

const CONNECT_ERROR_MARKER = "connect your bank account";

export function BuyNowButton({
  listingId,
  buyNowCents,
  disabled,
  currentUserId = null,
  className,
}: BuyNowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  const handleClick = async () => {
    try {
      setError(null);
      setLoading(true);
      const result = await secureJobAtPrice(listingId);
      if (result.ok) {
        // Hard refresh so job page loads with full server data and all action buttons
        window.location.href = `/jobs/${result.jobId}`;
        return;
      }
      const errMsg = result.error ?? "Something went wrong";
      if (errMsg.toLowerCase().includes(CONNECT_ERROR_MARKER) && currentUserId) {
        setConnectModalOpen(true);
      } else {
        setError(errMsg);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="success"
        onClick={handleClick}
        disabled={disabled || loading}
        className={cn(className)}
      >
        {loading ? "Securing…" : `${formatCents(buyNowCents)} BUY NOW`}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {currentUserId && (
        <ConnectRequiredModal
          open={connectModalOpen}
          onOpenChange={setConnectModalOpen}
          userId={currentUserId}
          startOnboarding={true}
        />
      )}
    </>
  );
}
