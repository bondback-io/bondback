"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import type { ProfileRole } from "@/lib/types";
import { normalizeProfileRolesFromDb } from "@/lib/profile-roles";
import { getPostLoginDashboardPath } from "@/lib/auth/post-login-redirect";
import { validateAbnIfRequired } from "@/lib/actions/validate-abn";
import {
  sendTutorialEmailsForRoles,
  sendWelcomeEmailAfterEmailVerification,
} from "@/lib/actions/onboarding-transactional-emails";

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

export type CompleteGoogleSignupProfileResult =
  | { ok: true; redirect: string }
  | { ok: false; error: string };

/**
 * After Google OAuth on combined sign-up: save first role + cleaner ABN (required for cleaner),
 * send welcome/tutorial emails, then return dashboard path. Email/password Path 2 is unchanged.
 */
export async function completeGoogleSignupProfile(input: {
  role: "lister" | "cleaner";
  /** 11-digit ABN — required when role is `cleaner`. */
  abn: string | null;
}): Promise<CompleteGoogleSignupProfileResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const userId = session.user.id;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Server configuration error." };
  }

  const { data: profile, error: fetchErr } = await admin
    .from("profiles")
    .select("id, roles, active_role, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (fetchErr || !profile) {
    return { ok: false, error: "Profile not found." };
  }

  const normalizedBefore = normalizeProfileRolesFromDb(
    (profile as { roles?: unknown }).roles,
    true
  );
  if (normalizedBefore.length > 0) {
    return { ok: false, error: "Your role is already set. Continue to your dashboard." };
  }

  const role = input.role;
  const roles: ProfileRole[] = [role];
  const active_role: ProfileRole = role;

  let abnStored: string | null = null;
  if (role === "cleaner") {
    const digits = (input.abn ?? "").replace(/\D/g, "");
    if (digits.length !== 11) {
      return { ok: false, error: "Enter your 11-digit ABN." };
    }
    const v = await validateAbnIfRequired(digits);
    if (!v.ok) {
      return { ok: false, error: v.error };
    }
    abnStored = digits;
  }

  const row: ProfileInsert = {
    id: userId,
    roles,
    active_role,
    suburb: "",
    postcode: null,
    max_travel_km: 30,
    abn: role === "cleaner" ? abnStored : null,
  };

  const { error: upsertErr } = await admin.from("profiles").upsert(row as never, { onConflict: "id" });
  if (upsertErr) {
    return { ok: false, error: upsertErr.message };
  }

  const {
    data: { session: sessionAfter },
  } = await supabase.auth.getSession();
  const sessionForEmail = sessionAfter ?? session;

  const { data: profileAfter } = await admin
    .from("profiles")
    .select("full_name, roles, active_role")
    .eq("id", userId)
    .maybeSingle();

  const firstName = (profileAfter as { full_name?: string | null } | null)?.full_name?.trim()?.split(" ")[0];

  /** `void` async IIFEs are dropped on Vercel serverless; `after()` keeps work alive after the response. */
  after(async () => {
    try {
      const { notifyAdminNewUserRegistration } = await import("@/lib/actions/admin-notify-email");
      await notifyAdminNewUserRegistration(userId).catch(() => {});
      await sendWelcomeEmailAfterEmailVerification({
        userId,
        session: sessionForEmail,
        trigger: "google_signup_profile_complete",
      });
      await sendTutorialEmailsForRoles({
        userId,
        session: sessionForEmail,
        firstName,
        roles: [role],
        skipEmailConfirmedCheck: true,
      });
    } catch (e) {
      console.error("[completeGoogleSignupProfile] transactional emails", {
        userId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/settings");

  const redirect = getPostLoginDashboardPath(
    profileAfter as Parameters<typeof getPostLoginDashboardPath>[0]
  );

  return { ok: true, redirect };
}
