"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCreateListingPicker } from "@/components/listing/create-listing-picker-context";

export type CreateListingCtaButtonProps = React.ComponentProps<typeof Button>;

/** Opens the global service-type picker (same as header Create Listing). */
export function CreateListingCtaButton({
  className,
  onClick,
  ...props
}: CreateListingCtaButtonProps) {
  const router = useRouter();
  const { openCreateListingPicker } = useCreateListingPicker();

  return (
    <Button
      type="button"
      {...props}
      className={cn(className)}
      onClick={(e) => {
        onClick?.(e);
        router.prefetch("/listings/new");
        openCreateListingPicker();
      }}
    />
  );
}
