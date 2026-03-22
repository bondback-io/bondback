"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import type { ProfileRole } from "@/lib/types";

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

export type SaveOnboardingResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Save onboarding profile. We verify the user with the cookie-based client,
 * then use the admin client to upsert so RLS/cookie issues in Server Actions
 * don't block the insert. Only the authenticated user's id is written.
 */
export async function saveOnboardingProfile(profile: {
  roles: ProfileRole[];
  active_role: ProfileRole;
  abn: string | null;
  date_of_birth?: string | null;
  suburb: string;
  postcode?: string | null;
  max_travel_km: number;
}): Promise<SaveOnboardingResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const userId = session.user.id;

  const row: ProfileInsert = {
    id: userId,
    roles: profile.roles,
    active_role: profile.active_role,
    abn: profile.abn,
    date_of_birth: profile.date_of_birth?.trim() || null,
    suburb: profile.suburb.trim(),
    postcode: profile.postcode?.trim() || null,
    max_travel_km: profile.max_travel_km,
  };

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "Server configuration error (admin client unavailable).",
    };
  }
  const { error } = await admin
    .from("profiles")
    .upsert(row as never, { onConflict: "id" });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Save cleaner onboarding: full profile fields + role = cleaner.
 * Redirects handled by caller (/jobs).
 */
export async function saveOnboardingCleanerProfile(profile: {
  full_name: string;
  phone: string;
  date_of_birth?: string | null;
  suburb: string;
  postcode: string | null;
  max_travel_km: number;
  years_experience: number;
  vehicle_type: string;
  abn: string | null;
}): Promise<SaveOnboardingResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const userId = session.user.id;

  const row: ProfileInsert = {
    id: userId,
    roles: ["lister", "cleaner"],
    active_role: "cleaner",
    abn: profile.abn?.trim() || null,
    suburb: profile.suburb.trim(),
    postcode: profile.postcode?.trim() || null,
    max_travel_km: profile.max_travel_km,
    full_name: profile.full_name.trim(),
    phone: profile.phone.trim(),
    date_of_birth: profile.date_of_birth?.trim() || null,
    years_experience: profile.years_experience,
    vehicle_type: profile.vehicle_type,
  };

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "Server configuration error (admin client unavailable).",
    };
  }
  const { error } = await admin
    .from("profiles")
    .upsert(row as never, { onConflict: "id" });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/onboarding");
  revalidatePath("/onboarding/cleaner");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  return { ok: true };
}

export type RoleChoice = "lister" | "cleaner" | "both";

export type SaveRoleChoiceResult =
  | { ok: true; redirect: string }
  | { ok: false; error: string };

/**
 * After signup: save initial role choice and return redirect path.
 * Creates or updates profile with roles and active_role. Does not require suburb etc.
 */
export async function saveRoleChoice(choice: RoleChoice): Promise<SaveRoleChoiceResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const userId = session.user.id;
  const roles: ProfileRole[] =
    choice === "both" ? ["lister", "cleaner"] : choice === "lister" ? ["lister"] : ["cleaner"];
  const active_role: ProfileRole = choice === "both" ? "lister" : choice;

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Server configuration error." };

  const { data: existing } = await admin
    .from("profiles")
    .select("id, suburb")
    .eq("id", userId)
    .maybeSingle();

  const row: Record<string, unknown> = {
    id: userId,
    roles,
    active_role,
    ...(existing
      ? {}
      : { suburb: "", postcode: null, max_travel_km: 30 }),
  };

  const { error } = await admin
    .from("profiles")
    .upsert(row as never, { onConflict: "id" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/onboarding");
  revalidatePath("/onboarding/role-choice");
  revalidatePath("/onboarding/both");
  revalidatePath("/dashboard");

  if (choice === "both") return { ok: true, redirect: "/onboarding/both" };
  if (choice === "cleaner") return { ok: true, redirect: "/onboarding/cleaner/details" };
  return { ok: true, redirect: "/dashboard" };
}

export type UnlockRoleResult =
  | { ok: true; redirect: string }
  | { ok: false; error: string };

/**
 * Unlock the other role from Settings. Appends to profiles.roles and sets active_role.
 * For cleaner: abn (11 digits) required. Redirects to role-specific onboarding stub.
 */
export async function unlockRole(
  newRole: "lister" | "cleaner",
  abn?: string | null
): Promise<UnlockRoleResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  if (newRole === "cleaner") {
    const trimmed = (abn ?? "").trim();
    if (!/^\d{11}$/.test(trimmed)) {
      return { ok: false, error: "ABN must be 11 digits." };
    }
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Server configuration error." };

  const { data: profile, error: fetchErr } = await admin
    .from("profiles")
    .select("roles, active_role, abn")
    .eq("id", session.user.id)
    .maybeSingle();

  if (fetchErr || !profile) {
    return { ok: false, error: "Profile not found." };
  }

  const currentRoles = (profile.roles as string[] | null) ?? [];
  if (currentRoles.includes(newRole)) {
    return { ok: false, error: "You already have this role." };
  }

  const updatedRoles = [...currentRoles, newRole];
  const update: Record<string, unknown> = {
    roles: updatedRoles,
    active_role: newRole,
  };
  if (newRole === "cleaner" && abn?.trim()) {
    update.abn = abn.trim();
  }

  const { error: updateErr } = await admin
    .from("profiles")
    .update(update as never)
    .eq("id", session.user.id);

  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/dashboard");

  if (newRole === "cleaner") return { ok: true, redirect: "/onboarding/cleaner-welcome" };
  return { ok: true, redirect: "/onboarding/lister-welcome" };
}

export type CompleteOnboardingFromSignupResult =
  | { ok: true }
  | { ok: false; error: string };

export type OnboardingDetailsInput = {
  full_name: string;
  phone: string;
  state: string;
  suburb: string;
  postcode: string;
  abn: string;
};

/**
 * After Supabase signUp (session exists): create profile with role + details from pre-auth flow.
 * Call this from /onboarding/signup (or /onboarding/complete-profile after email confirm).
 */
export async function completeOnboardingFromSignup(
  role: RoleChoice,
  details: OnboardingDetailsInput,
  options?: { referralCode?: string | null }
): Promise<CompleteOnboardingFromSignupResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Server configuration error." };

  const roles: ProfileRole[] =
    role === "both" ? ["lister", "cleaner"] : role === "lister" ? ["lister"] : ["cleaner"];
  const active_role: ProfileRole = role === "both" ? "lister" : role;

  let referredBy: string | null = null;
  const rawRef = options?.referralCode?.trim();
  if (rawRef) {
    const normalized = rawRef.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalized.length >= 4) {
      const { data: refProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("referral_code", normalized)
        .maybeSingle();
      const rid = (refProfile as { id?: string } | null)?.id;
      if (rid && rid !== session.user.id) {
        referredBy = rid;
      }
    }
  }

  const { data: existingProf } = await admin
    .from("profiles")
    .select("referred_by")
    .eq("id", session.user.id)
    .maybeSingle();
  const alreadyReferred = (existingProf as { referred_by?: string | null } | null)?.referred_by;

  const row: ProfileInsert = {
    id: session.user.id,
    roles,
    active_role,
    full_name: details.full_name.trim() || null,
    phone: details.phone.trim() || null,
    state: details.state.trim() || null,
    suburb: details.suburb.trim() || "",
    postcode: details.postcode.trim() || null,
    max_travel_km: 30,
    abn: (role === "cleaner" || role === "both") && /^\d{11}$/.test((details.abn || "").replace(/\D/g, ""))
      ? details.abn.replace(/\D/g, "")
      : null,
    ...(!alreadyReferred && referredBy ? { referred_by: referredBy } : {}),
  };

  const { error } = await admin
    .from("profiles")
    .upsert(row as never, { onConflict: "id" });

  if (error) return { ok: false, error: error.message };

  const email = session.user.email;
  if (email) {
    const { getGlobalSettings } = await import("@/lib/actions/global-settings");
    const { getNotificationPrefs } = await import("@/lib/supabase/admin");
    const globalSettings = await getGlobalSettings();
    if (globalSettings?.emails_enabled !== false) {
      const prefs = await getNotificationPrefs(session.user.id);
      const emailWelcome = prefs?.notificationPreferences?.email_welcome;
      if (emailWelcome !== false) {
        const { sendEmail, buildWelcomeEmail } = await import("@/lib/notifications/email");
        const firstName = details.full_name?.trim()?.split(" ")[0];
        const signupRole = role === "both" ? "both" : role === "lister" ? "lister" : "cleaner";
        const { subject, html } = await buildWelcomeEmail(firstName, signupRole);
        await sendEmail(email, subject, html);
      }
    }
  }

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true };
}
