"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { cn } from "@/lib/utils";

export type DashboardWelcomeBarProps = {
  name: string;
  role: "lister" | "cleaner";
  roleLabel: string;
  subtitle?: string;
  /** If user has multiple roles, show switcher */
  hasDualRole?: boolean;
  sessionPayload?: {
    user: { id: string; email?: string };
    profile: { full_name: string | null; roles: string[]; activeRole: string; profile_photo_url: string | null };
    roles: string[];
    activeRole: string;
    isAdmin?: boolean;
  };
};

export function DashboardWelcomeBar({
  name,
  role,
  roleLabel,
  subtitle,
  hasDualRole,
  sessionPayload,
}: DashboardWelcomeBarProps) {
  const accentClass =
    role === "lister"
      ? "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200"
      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground dark:text-gray-100 sm:text-2xl">
            Welcome back{name ? `, ${name}` : ""}
          </h1>
          <Badge className={cn("shrink-0 text-xs font-medium", accentClass)}>
            {roleLabel}
          </Badge>
          {hasDualRole && sessionPayload && (
            <RoleSwitcher session={sessionPayload as any} />
          )}
        </div>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
