"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { CreateListingConfirmDialog } from "@/components/listing/create-listing-confirm-dialog";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<typeof Button>, "asChild" | "onClick"> & {
  children?: React.ReactNode;
};

/** Same “New bond clean listing?” dialog as main nav / FAB — not a direct link. */
export function MyListingsNewListingButton({
  children = "New listing",
  className,
  ...props
}: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(className)}
        {...props}
      >
        {children}
      </Button>
      <CreateListingConfirmDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
