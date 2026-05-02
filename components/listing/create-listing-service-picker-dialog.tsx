"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CREATE_LISTING_SERVICE_PICKER_OPTIONS } from "@/lib/create-listing-service-picker-options";
import { CALENDAR_SERVICE_TYPE_ROW_ACCENT } from "@/lib/calendar/service-type-calendar";
import { normalizeServiceType } from "@/lib/service-types";
import { ChevronRight } from "lucide-react";

export function CreateListingServicePickerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const navigateWithService = (serviceType: string) => {
    onOpenChange(false);
    const qs = new URLSearchParams();
    qs.set("service_type", serviceType);
    router.push(`/listings/new?${qs.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md gap-0 overflow-hidden border-2 p-0 shadow-2xl sm:rounded-2xl",
          "border-emerald-800/60 bg-emerald-950 text-emerald-50",
          "dark:border-emerald-700/80 dark:bg-emerald-950 dark:text-emerald-50",
          "[&>button]:text-emerald-200 [&>button]:hover:bg-emerald-900/80 [&>button]:hover:text-white"
        )}
      >
        <DialogHeader className="space-y-2 border-b border-emerald-800/50 px-5 pb-4 pt-5 text-left dark:border-emerald-800/60">
          <DialogTitle className="text-xl font-semibold tracking-tight text-white">
            Create a listing
          </DialogTitle>
          <DialogDescription className="text-left text-[15px] leading-relaxed text-emerald-100/85">
            Choose the service type you need. You can adjust details on the next steps.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-3 py-3">
          <ul className="flex flex-col gap-2" role="listbox" aria-label="Listing service types">
            {CREATE_LISTING_SERVICE_PICKER_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const accent =
                CALENDAR_SERVICE_TYPE_ROW_ACCENT[normalizeServiceType(opt.value)];
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    className={cn(
                      "flex w-full min-h-[56px] items-center gap-3 rounded-2xl border-2 border-emerald-800/40 border-l-4 bg-emerald-900/35 px-4 py-3 text-left transition-colors",
                      accent.rowBorderLeft,
                      "hover:border-emerald-500/70 hover:bg-emerald-900/55 active:scale-[0.99]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950",
                      accent.focusRing
                    )}
                    onClick={() => navigateWithService(opt.value)}
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                        accent.iconWell
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-white">{opt.title}</span>
                      <span className="mt-0.5 block text-sm text-emerald-200/80">{opt.subtitle}</span>
                    </span>
                    <ChevronRight
                      className={cn("h-5 w-5 shrink-0", accent.chevron)}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

      </DialogContent>
    </Dialog>
  );
}
