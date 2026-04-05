"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

function buttonLabelForNext(nextPath: string): string {
  if (nextPath.startsWith("/onboarding")) {
    return "Continue setup";
  }
  return "Go to dashboard";
}

export type EmailConfirmedContentProps = {
  nextPath: string;
  firstName: string;
};

export function EmailConfirmedContent({ nextPath, firstName }: EmailConfirmedContentProps) {
  const router = useRouter();

  const go = () => {
    router.replace(nextPath);
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-12">
      <Card className="border-border/80 shadow-md dark:border-gray-800 dark:bg-gray-900/80">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" aria-hidden />
            </span>
          </div>
          <CardTitle className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
            Welcome, {firstName}! Email confirmed and activated :)
          </CardTitle>
          <CardDescription className="text-left text-base leading-relaxed text-muted-foreground dark:text-gray-300">
            Thanks for proving you&apos;re not a robot (or a very clever dog). Your Bond Back account
            is officially <strong className="text-foreground dark:text-gray-100">real</strong> —
            we&apos;ve marked your email as confirmed, and we&apos;re not pulling your leg about the
            bond-clean thing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={go}>
            {buttonLabelForNext(nextPath)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
