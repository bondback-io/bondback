"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Green-themed confirmation before navigating to /listings/new (header FAB + main nav). */
export function CreateListingConfirmDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-emerald-200 bg-emerald-50 text-emerald-950 shadow-xl dark:border-emerald-800 dark:bg-emerald-950/95 dark:text-emerald-50">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
            New bond clean listing
          </DialogTitle>
          <DialogDescription className="text-left text-base text-emerald-800/95 dark:text-emerald-50/90">
            Do you want to create a new bond clean listing?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100 dark:hover:bg-emerald-900"
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            onClick={() => {
              onOpenChange(false);
              router.push("/listings/new");
            }}
          >
            Yes, continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
