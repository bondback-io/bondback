"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardFabProps = {
  href: string;
  label: string;
  variant: "create-listing" | "browse-jobs";
  className?: string;
};

export function DashboardFab({
  href,
  label,
  variant,
  className,
}: DashboardFabProps) {
  const Icon = variant === "create-listing" ? Plus : Search;
  return (
    <Link
      href={href}
      className={cn(
        "fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg transition active:scale-95 sm:hidden",
        variant === "create-listing"
          ? "bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90"
          : "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500",
        className
      )}
      aria-label={label}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
