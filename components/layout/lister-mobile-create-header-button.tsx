"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { CreateListingConfirmDialog } from "@/components/listing/create-listing-confirm-dialog";

/** Mobile header green + — same “New bond clean listing?” prompt as other create-listing entry points. */
export function ListerMobileCreateListingHeaderButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-900/20 ring-1 ring-emerald-500/30 transition hover:bg-emerald-700 active:scale-[0.98] dark:bg-emerald-600 dark:shadow-emerald-950/40 dark:ring-emerald-400/25 dark:hover:bg-emerald-500"
        aria-label="Create listing"
        title="Create listing"
      >
        <Plus className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
      </button>
      <CreateListingConfirmDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
