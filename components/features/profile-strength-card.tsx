"use client";

import { useEffect, useMemo, useState } from "react";
import type { Database } from "@/types/supabase";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { calculateProfileStrengthPercent } from "@/lib/profile-strength";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

interface ProfileStrengthCardProps {
  initialProfile: ProfileRow;
}

function profileStrengthUi(profile: ProfileRow): {
  percent: number;
  message: string;
  variant: "low" | "medium" | "high";
} {
  const percent = calculateProfileStrengthPercent(profile);

  let message = "";
  let variant: "low" | "medium" | "high" = "low";

  if (percent < 70) {
    message = "Complete your profile to win more jobs!";
    variant = "low";
  } else if (percent < 100) {
    message = "Almost there – add portfolio photos and details!";
    variant = "medium";
  } else {
    message = "Profile complete! You're ready to win more jobs.";
    variant = "high";
  }

  return { percent, message, variant };
}

export function ProfileStrengthCard({ initialProfile }: ProfileStrengthCardProps) {
  const [profile, setProfile] = useState<ProfileRow>(initialProfile);

  const { percent, message, variant } = useMemo(
    () => profileStrengthUi(profile),
    [profile]
  );

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const channel = supabase
      .channel("profile-strength")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          setProfile((prev) => ({
            ...prev,
            ...(payload.new as Partial<ProfileRow>),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id]);

  const ringColor =
    variant === "high"
      ? "text-emerald-500"
      : variant === "medium"
      ? "text-sky-500"
      : "text-amber-500";

  const progressIndicatorColor =
    variant === "high"
      ? "bg-emerald-500"
      : variant === "medium"
      ? "bg-sky-500"
      : "bg-amber-500";

  return (
    <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-sm font-semibold md:text-base dark:text-gray-100">
          Profile strength
        </CardTitle>
        <Badge
          variant="outline"
          className={cn(
            "text-[11px]",
            variant === "high"
              ? "border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-300"
              : variant === "medium"
              ? "border-sky-500 text-sky-600 dark:border-sky-400 dark:text-sky-300"
              : "border-amber-500 text-amber-600 dark:border-amber-400 dark:text-amber-300"
          )}
        >
          {Math.round(percent)}%
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-xs md:text-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
              <defs>
                <linearGradient id="profileStrengthGradient" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="50%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <path
                className="text-muted/40"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="transparent"
                d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31z"
              />
              <path
                className={cn("transition-all duration-500 ease-out", ringColor)}
                stroke="url(#profileStrengthGradient)"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray="97.39"
                strokeDashoffset={97.39 * (1 - percent / 100)}
                d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31z"
              />
            </svg>
            <span className="absolute text-[11px] font-semibold sm:text-xs">
              {Math.round(percent)}%
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              Profile completion
            </p>
            <p className="text-xs text-foreground dark:text-gray-100">{message}</p>
          </div>
        </div>
        <Progress
          value={percent}
          className="h-2"
          indicatorClassName={cn(
            "transition-all duration-500 ease-out",
            progressIndicatorColor
          )}
        />
        <p className="text-[11px] text-muted-foreground dark:text-gray-400">
          Complete your photo, bio, specialties, portfolio, ABN, contact details and
          availability to build trust with listers.
        </p>
        {variant === "low" && (
          <Alert variant="info" className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] sm:text-xs">
              Profiles with photos and details are more likely to win bond cleans.
            </span>
            <Button
              asChild
              size="xs"
              className="mt-1 w-full rounded-full text-[11px] font-semibold sm:mt-0 sm:w-auto"
            >
              <a href="/profile">Complete profile</a>
            </Button>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

