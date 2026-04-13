"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const END_AUCTION_HELP =
  "Need to stop the auction? End this listing early — no new bids will be accepted, and cleaners who already bid will see it as ended. The listing stays in your history.";

type ListerEndAuctionControlProps = {
  onRequestCancel: () => void;
};

/**
 * Compact control for listers: explanation lives in a popover (tap / click); cancel opens the existing confirm dialog.
 */
export function ListerEndAuctionControl({ onRequestCancel }: ListerEndAuctionControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          aria-label="End auction early — information and options"
        >
          <Info className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span className="hidden min-[380px]:inline">End early</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-2rem),22rem)] border-border p-4 shadow-lg dark:border-gray-800"
        align="end"
        sideOffset={8}
      >
        <p className="text-sm leading-relaxed text-muted-foreground dark:text-gray-300">
          {END_AUCTION_HELP}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 w-full border-destructive/35 text-destructive hover:bg-destructive/10 dark:border-destructive/50 dark:text-red-300"
          onClick={() => {
            setOpen(false);
            onRequestCancel();
          }}
        >
          Cancel listing
        </Button>
      </PopoverContent>
    </Popover>
  );
}
