"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Sparkles, Users } from "lucide-react";
import { setOnboardingRole, setPendingReferralCode, type OnboardingRole } from "./onboarding-storage";

export function RoleChoiceClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref?.trim()) {
      setPendingReferralCode(ref);
    }
  }, [searchParams]);

  const handleChoice = (role: OnboardingRole) => {
    setOnboardingRole(role);
    router.push(`/onboarding/${role}/details`);
  };

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight dark:text-gray-100 md:text-3xl">
          Who are you today?
        </h1>
        <p className="text-base text-muted-foreground dark:text-gray-400 md:text-sm">
          Choose how you&apos;ll use Bond Back. You can add the other role anytime in Settings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
        <Card
          className="cursor-pointer border-2 border-transparent transition-all hover:border-sky-300 hover:shadow-md dark:hover:border-sky-700 dark:border-gray-800 dark:bg-gray-900"
          onClick={() => handleChoice("lister")}
        >
          <CardHeader className="pb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/50">
              <Home className="h-6 w-6 text-sky-600 dark:text-sky-400" />
            </div>
            <CardTitle className="text-lg dark:text-gray-100">I&apos;m a Lister</CardTitle>
            <CardDescription className="text-base dark:text-gray-400 md:text-sm">
              I need my property cleaned. I&apos;ll list a bond clean and hire a cleaner.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card
          className="cursor-pointer border-2 border-transparent transition-all hover:border-emerald-300 hover:shadow-md dark:hover:border-emerald-700 dark:border-gray-800 dark:bg-gray-900"
          onClick={() => handleChoice("cleaner")}
        >
          <CardHeader className="pb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
              <Sparkles className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-lg dark:text-gray-100">I&apos;m a Cleaner</CardTitle>
            <CardDescription className="text-base dark:text-gray-400 md:text-sm">
              I want to earn money. I&apos;ll bid on bond clean jobs and get hired.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card
          className="cursor-pointer border-2 border-transparent transition-all hover:border-amber-300 hover:shadow-md dark:hover:border-amber-700 dark:border-gray-800 dark:bg-gray-900"
          onClick={() => handleChoice("both")}
        >
          <CardHeader className="pb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
              <Users className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-lg dark:text-gray-100">I want to do both</CardTitle>
            <CardDescription className="text-base dark:text-gray-400 md:text-sm">
              List jobs and clean. Switch between roles anytime in the header.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <p className="text-center text-sm text-muted-foreground dark:text-gray-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline underline-offset-2">
          Log in
        </Link>
      </p>
    </div>
  );
}
