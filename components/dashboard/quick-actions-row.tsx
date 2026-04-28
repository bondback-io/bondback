"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCreateListingPicker } from "@/components/listing/create-listing-picker-context";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Briefcase,
  CheckCircle2,
  DollarSign,
  List,
  Gavel,
  type LucideIcon,
} from "lucide-react";

/** Icon names that can be passed from Server Components (plain strings). */
export type ActionIconName =
  | "plus"
  | "search"
  | "briefcase"
  | "check-circle"
  | "dollar-sign"
  | "list"
  | "gavel";

const ICON_MAP: Record<ActionIconName, LucideIcon> = {
  plus: Plus,
  search: Search,
  briefcase: Briefcase,
  "check-circle": CheckCircle2,
  "dollar-sign": DollarSign,
  list: List,
  gavel: Gavel,
};

export type ActionItem = {
  label: string;
  href: string;
  primary?: boolean;
  /** Icon identifier (string) so Server Components can pass actions safely. */
  icon?: ActionIconName;
  /** Opens the service-type picker; `href` is only used for prefetch/fallback. */
  useCreateListingPicker?: boolean;
};

export type QuickActionsRowProps = {
  actions: ActionItem[];
  className?: string;
};

export function QuickActionsRow({ actions, className }: QuickActionsRowProps) {
  const router = useRouter();
  const { openCreateListingPicker } = useCreateListingPicker();

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
      style={{ scrollbarWidth: "none" }}
    >
      {actions.map((action, i) => {
        const Icon = action.icon ? ICON_MAP[action.icon] : null;
        const btn =
          action.useCreateListingPicker === true ? (
            <Button
              type="button"
              size="default"
              variant={action.primary ? "success" : "outline"}
              className={cn(
                "min-w-[140px] shrink-0 sm:min-w-0 transition-transform active:scale-[0.98] sm:hover:scale-[1.02]"
              )}
              onClick={() => {
                router.prefetch(action.href);
                openCreateListingPicker();
              }}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              <span className="truncate">{action.label}</span>
            </Button>
          ) : (
            <Button
              asChild
              size="default"
              variant={action.primary ? "success" : "outline"}
              className={cn(
                "min-w-[140px] shrink-0 sm:min-w-0 transition-transform active:scale-[0.98] sm:hover:scale-[1.02]"
              )}
            >
              <Link href={action.href} className="inline-flex items-center justify-center gap-2">
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className="truncate">{action.label}</span>
              </Link>
            </Button>
          );
        return <div key={i}>{btn}</div>;
      })}
    </div>
  );
}
