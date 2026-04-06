import type { Metadata } from "next";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import type { SessionWithProfile } from "@/lib/types";
import { sendEmailPasswordSignupTransactionalEmailsAfterConfirmationPage } from "@/lib/actions/onboarding-transactional-emails";
import { EmailConfirmedContent } from "./email-confirmed-content";

export const metadata: Metadata = {
  title: "Email confirmed",
  description: "Your Bond Back account email has been confirmed.",
};

function firstParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string | null {
  const v = sp[key];
  if (v === undefined) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function firstNameFromSession(session: SessionWithProfile | null): string {
  const full = session?.profile?.full_name?.trim();
  if (full) {
    const part = full.split(/\s+/)[0];
    if (part) return part;
  }
  const emailLocal = session?.user?.email?.split("@")[0]?.trim();
  if (emailLocal) {
    const word = emailLocal.split(/[._+-]/)[0];
    if (word) {
      return word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase();
    }
  }
  return "there";
}

export default async function EmailConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const nextPath = sanitizeInternalNextPath(firstParam(sp, "next"), "/dashboard");
  const session = await getSessionWithProfile();
  const firstName = firstNameFromSession(session);

  if (session?.user?.id) {
    await sendEmailPasswordSignupTransactionalEmailsAfterConfirmationPage();
  }

  return <EmailConfirmedContent nextPath={nextPath} firstName={firstName} />;
}
