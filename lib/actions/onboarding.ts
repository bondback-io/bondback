"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import type { ProfileRole } from "@/lib/types";
import { normalizeProfileRolesFromDb } from "@/lib/profile-roles";

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
 * After `/signup` (session present): create a minimal profile row with `roles: []`
 * until the user picks lister vs cleaner on `/onboarding/role-choice`.
 * Preserves dual-role backend; first concrete role is applied in `saveRoleChoice`.
 */
export async function upsertMinimalProfileAfterSignup(input: {
  full_name: string;
  postcode: string | null;
  suburb?: string | null;
  referralCode?: string | null;
}): Promise<SaveOnboardingResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const userId = session.user.id;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "Server configuration error (admin client unavailable).",
    };
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("roles, referred_by")
    .eq("id", userId)
    .maybeSingle();

  const existingRoles = (existing?.roles as string[] | null) ?? [];
  if (existingRoles.length > 0) {
    revalidatePath("/dashboard");
    return { ok: true };
  }

  let referredBy: string | null = null;
  const rawRef = input.referralCode?.trim();
  if (rawRef) {
    const normalized = rawRef.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalized.length >= 4) {
      const { data: refProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("referral_code", normalized)
        .maybeSingle();
      const rid = (refProfile as { id?: string } | null)?.id;
      if (rid && rid !== userId) {
        referredBy = rid;
      }
    }
  }

  const alreadyReferred = (existing as { referred_by?: string | null } | null)?.referred_by;

  const row: ProfileInsert = {
    id: userId,
    full_name: input.full_name.trim() || null,
    postcode: input.postcode?.trim() || null,
    suburb: input.suburb?.trim() ?? "",
    max_travel_km: 30,
    roles: [],
    ...(!alreadyReferred && referredBy ? { referred_by: referredBy } : {}),
  };

  const { error } = await admin.from("profiles").upsert(row as never, { onConflict: "id" });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Cleaner quick-setup: optional ABN + travel radius after `saveRoleChoice("cleaner")`.
 */
export async function saveCleanerQuickSetup(input: {
  abn: string | null;
  max_travel_km: number;
}): Promise<SaveOnboardingResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const userId = session.user.id;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "Server configuration error (admin client unavailable).",
    };
  }

  const { data: profile, error: fetchErr } = await admin
    .from("profiles")
    .select("roles")
    .eq("id", userId)
    .maybeSingle();

  if (fetchErr || !profile) {
    return { ok: false, error: "Profile not found." };
  }

  const roles = (profile.roles as string[] | null) ?? [];
  if (!roles.includes("cleaner")) {
    return { ok: false, error: "Complete role choice as a cleaner first." };
  }

  const digits = (input.abn ?? "").replace(/\D/g, "");
  const abn = digits.length === 11 ? digits : null;

  const { error } = await admin
    .from("profiles")
    .update({
      abn,
      max_travel_km: Math.min(200, Math.max(5, Math.round(input.max_travel_km))),
    } as never)
    .eq("id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/onboarding");
  revalidatePath("/cleaner/dashboard");
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
    .select("id, suburb, roles")
    .eq("id", userId)
    .maybeSingle();

  const existingRoles = (existing?.roles as string[] | null) ?? [];
  const isFirstRoleAssignment = existingRoles.length === 0;

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

  if (isFirstRoleAssignment) {
    void import("@/lib/actions/admin-notify-email").then((m) =>
      m.notifyAdminNewUserRegistration(userId).catch(() => {})
    );
  }

  const {
    data: { session: sessionForEmail },
  } = await supabase.auth.getSession();
  if (isFirstRoleAssignment && sessionForEmail) {
    const { data: nameRow } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const fullName = (nameRow as { full_name?: string | null } | null)?.full_name ?? null;
    const tutorialRoles =
      choice === "both" ? (["lister", "cleaner"] as const) : choice === "lister" ? (["lister"] as const) : (["cleaner"] as const);
    try {
      const { sendTutorialEmailsForRoles } = await import("@/lib/actions/onboarding-transactional-emails");
      await sendTutorialEmailsForRoles({
        userId,
        session: sessionForEmail,
        firstName: fullName?.trim()?.split(" ")[0],
        roles: [...tutorialRoles],
        skipEmailConfirmedCheck: true,
      });
    } catch (e) {
      console.error("[saveRoleChoice] tutorial emails failed", e);
    }
  }

  revalidatePath("/onboarding");
  revalidatePath("/onboarding/role-choice");
  revalidatePath("/onboarding/both");
  revalidatePath("/dashboard");

  if (choice === "both") return { ok: true, redirect: "/onboarding/both" };
  if (choice === "cleaner") {
    return { ok: true, redirect: "/onboarding/cleaner/quick-setup" };
  }
  return { ok: true, redirect: "/onboarding/lister/quick-setup" };
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
    .select("roles, active_role, abn, full_name")
    .eq("id", session.user.id)
    .maybeSingle();

  if (fetchErr || !profile) {
    return { ok: false, error: "Profile not found." };
  }

  /** Must match session / `normalizeProfileRolesFromDb` — `null` roles = legacy lister, not []. */
  const currentRoles = normalizeProfileRolesFromDb(profile.roles, true);
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

  const {
    data: { session: sessionForEmail },
  } = await supabase.auth.getSession();
  if (sessionForEmail) {
    const firstName =
      (profile as { full_name?: string | null }).full_name?.trim()?.split(" ")[0];
    void import("@/lib/actions/onboarding-transactional-emails").then((m) =>
      m
        .sendTutorialEmailsForRoles({
          userId: session.user.id,
          session: sessionForEmail,
          firstName,
          roles: [newRole],
          skipEmailConfirmedCheck: true,
        })
        .catch(() => {})
    );
  }

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
    .select("referred_by, roles")
    .eq("id", session.user.id)
    .maybeSingle();
  const alreadyReferred = (existingProf as { referred_by?: string | null } | null)?.referred_by;
  const hadRolesAlready =
    Array.isArray((existingProf as { roles?: string[] | null } | null)?.roles) &&
    ((existingProf as { roles?: string[] | null }).roles as string[]).length > 0;

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

  if (!hadRolesAlready) {
    void import("@/lib/actions/admin-notify-email").then((m) =>
      m.notifyAdminNewUserRegistration(session.user.id).catch(() => {})
    );
    const { sendWelcomeEmailAfterEmailVerification, sendTutorialEmailsForRoles } = await import(
      "@/lib/actions/onboarding-transactional-emails"
    );
    const firstName = details.full_name?.trim()?.split(" ")[0];
    const tutorialRoles =
      role === "both" ? (["lister", "cleaner"] as const) : role === "lister" ? (["lister"] as const) : (["cleaner"] as const);
    await sendWelcomeEmailAfterEmailVerification({
      userId: session.user.id,
      session,
      trigger: "onboarding_signup_complete",
    });
    await sendTutorialEmailsForRoles({
      userId: session.user.id,
      session,
      firstName,
      roles: [...tutorialRoles],
      skipEmailConfirmedCheck: true,
    });
  }

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true };
}
