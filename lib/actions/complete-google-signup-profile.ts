"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import type { ProfileRole } from "@/lib/types";
import { normalizeProfileRolesFromDb } from "@/lib/profile-roles";
import { getPostLoginDashboardPath } from "@/lib/auth/post-login-redirect";
import { getGoogleProfileFieldsForSync } from "@/lib/auth/google-user-metadata";
import { validateAbnIfRequired } from "@/lib/actions/validate-abn";
import {
  sendTutorialEmailsForRoles,
  sendWelcomeEmailAfterEmailVerification,
} from "@/lib/actions/onboarding-transactional-emails";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

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
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const userId = user.id;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Server configuration error." };
  }

  const { data: profile, error: fetchErr } = await admin
    .from("profiles")
    .select("id, roles, active_role, full_name, first_name, last_name, profile_photo_url, avatar_url")
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

  /** Use `.update()` only — partial `.upsert()` can null out omitted columns and wipe OAuth names. */
  const googleFields = await getGoogleProfileFieldsForSync(user);
  const p = profile as {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    profile_photo_url?: string | null;
    avatar_url?: string | null;
  } | null;

  const update: ProfileUpdate = {
    roles,
    active_role,
    suburb: "",
    postcode: null,
    max_travel_km: 30,
    abn: role === "cleaner" ? abnStored : null,
    updated_at: new Date().toISOString(),
  };

  if (!p?.full_name?.trim() && googleFields.fullName) {
    update.full_name = googleFields.fullName;
  }
  if (!p?.first_name?.trim() && googleFields.givenName) {
    update.first_name = googleFields.givenName;
  }
  if (!p?.last_name?.trim() && googleFields.familyName) {
    update.last_name = googleFields.familyName;
  }
  if (googleFields.pictureUrl) {
    update.avatar_url = googleFields.pictureUrl;
    if (!p?.profile_photo_url?.trim()) {
      update.profile_photo_url = googleFields.pictureUrl;
    }
  }

  const { error: updateErr } = await admin.from("profiles").update(update as never).eq("id", userId);
  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  const {
    data: { session: sessionAfter },
  } = await supabase.auth.getSession();

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
      if (!sessionAfter) {
        console.warn("[completeGoogleSignupProfile] skip welcome/tutorial emails: no cookie session");
        return;
      }
      await sendWelcomeEmailAfterEmailVerification({
        userId,
        session: sessionAfter,
        trigger: "google_signup_profile_complete",
      });
      await sendTutorialEmailsForRoles({
        userId,
        session: sessionAfter,
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
