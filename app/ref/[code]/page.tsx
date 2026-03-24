import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site";

type Props = { params: Promise<{ code: string }> };

function normalizeCode(raw: string): string {
  return decodeURIComponent(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Share-friendly landing URL with Open Graph / Twitter metadata for referral links.
 * Redirects to onboarding with ?ref= preserved.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const c = normalizeCode(code);
  const base = getSiteUrl().origin;
  const title = c.length >= 4 ? `Join Bond Back — referral ${c}` : "Join Bond Back";
  const description =
    c.length >= 4
      ? `Sign up with code ${c}. Complete your first bond clean on Bond Back to earn referral rewards.`
      : "Australian bond cleaning marketplace — list, bid, and get your bond back.";

  return {
    title,
    description,
    alternates: {
      canonical: `/ref/${encodeURIComponent(c || code)}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${base}/ref/${encodeURIComponent(c || code)}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ReferralLandingPage({ params }: Props) {
  const { code } = await params;
  const c = normalizeCode(code);
  if (c.length < 4) {
    redirect("/onboarding/role-choice");
  }
  redirect(`/onboarding/role-choice?ref=${encodeURIComponent(c)}`);
}
