"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Gift, Link2, Copy, Check } from "lucide-react";
import { formatCents } from "@/lib/listings";
import { ReferralShareButtons } from "@/components/features/referral-share-buttons";

export type ProfileReferralSectionProps = {
  referralCode: string;
  accountCreditCents: number;
  appOrigin: string;
  referralTermsText?: string | null;
  referrerRewardDollars: number;
  referredRewardDollars: number;
};

/**
 * Referral share UI when `global_settings.referral_enabled` is true.
 * Link format: /onboarding/role-choice?ref=CODE (also ?ref= on signup works).
 */
export function ProfileReferralSection({
  referralCode,
  accountCreditCents,
  appOrigin,
  referralTermsText,
  referrerRewardDollars,
  referredRewardDollars,
}: ProfileReferralSectionProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  /** `/ref/[code]` has Open Graph metadata for social previews; redirects to onboarding. */
  const shareUrl = `${appOrigin.replace(/\/$/, "")}/ref/${encodeURIComponent(referralCode)}`;
  const shareTitle = `Join Bond Back — referral ${referralCode}`;
  const shareSummary = `Use my referral on Bond Back: ${referralCode}. We both earn credit when you complete your first job.`;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Try selecting the text manually." });
    }
  };

  return (
    <Card className="max-w-xl border-sky-200/80 bg-sky-50/40 dark:border-sky-800 dark:bg-sky-950/30">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          <CardTitle className="text-lg dark:text-gray-100">Refer a friend</CardTitle>
        </div>
        <CardDescription className="dark:text-gray-400">
          Share your code. When someone signs up with your link and completes their first job, you earn{" "}
          <strong className="text-foreground dark:text-gray-200">${referrerRewardDollars.toFixed(2)}</strong> credit and
          they earn{" "}
          <strong className="text-foreground dark:text-gray-200">${referredRewardDollars.toFixed(2)}</strong> — see
          global settings for minimum job value and monthly limits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background/80 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/50">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-500">
              Account credit
            </p>
            <p className="text-lg font-semibold tabular-nums dark:text-gray-100">{formatCents(accountCreditCents)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground dark:text-gray-400">Your referral code</label>
          <div className="flex flex-wrap gap-2">
            <Input readOnly value={referralCode} className="font-mono text-sm dark:bg-gray-900" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => copy(referralCode, "Referral code")}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">Copy code</span>
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground dark:text-gray-400">Share link</label>
          <div className="flex flex-wrap gap-2">
            <Input readOnly value={shareUrl} className="text-xs dark:bg-gray-900" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => copy(shareUrl, "Share link")}
            >
              <Link2 className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">Copy link</span>
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground dark:text-gray-400">Share</p>
          <ReferralShareButtons shareUrl={shareUrl} title={shareTitle} summary={shareSummary} />
        </div>

        {referralTermsText?.trim() && (
          <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-gray-500">{referralTermsText.trim()}</p>
        )}
      </CardContent>
    </Card>
  );
}
