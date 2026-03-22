import { Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

type SiteAnnouncementBannerProps = {
  text: string;
};

export function SiteAnnouncementBanner({ text }: SiteAnnouncementBannerProps) {
  if (!text?.trim()) return null;

  return (
    <div className="w-full border-b border-sky-200 bg-sky-50 px-3 py-2 text-xs sm:text-sm text-slate-800 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-50">
      <div className="mx-auto flex max-w-6xl items-start gap-2 sm:items-center">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-800 dark:text-sky-200">
          <Megaphone className="h-3.5 w-3.5" aria-hidden />
        </div>
        <p className={cn("flex-1 leading-snug")}>{text}</p>
      </div>
    </div>
  );
}

