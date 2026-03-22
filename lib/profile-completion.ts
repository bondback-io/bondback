import type { Database } from "@/types/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Compute profile completion percentage (0–100) and a short message for empty fields.
 */
export function getProfileCompletion(profile: ProfileRow | null): {
  percent: number;
  message: string | null;
} {
  if (!profile) {
    return { percent: 0, message: "Complete your profile to get started." };
  }

  const activeRole = (profile.active_role as string | null) ?? null;
  const isCleaner = activeRole === "cleaner";

  if (!isCleaner) {
    const hasName = !!profile.full_name?.trim();
    const hasPhone = !!profile.phone?.trim();
    const hasSuburb = !!profile.suburb?.trim();
    const filled = [hasName, hasPhone, hasSuburb].filter(Boolean).length;
    const percent = Math.round((filled / 3) * 100);
    const missing: string[] = [];
    if (!hasName) missing.push("full name");
    if (!hasPhone) missing.push("phone");
    if (!hasSuburb) missing.push("suburb");
    const message =
      missing.length > 0
        ? `Add ${missing.join(", ")} to complete your profile.`
        : null;
    return { percent, message };
  }

  // Cleaner: more fields
  const checks = [
    !!profile.full_name?.trim(),
    !!profile.phone?.trim(),
    !!profile.suburb?.trim(),
    (profile.abn ?? "").replace(/\D/g, "").length === 11,
    !!profile.profile_photo_url?.trim(),
    !!profile.bio?.trim(),
    Array.isArray(profile.specialties) && profile.specialties.length > 0,
    Array.isArray(profile.portfolio_photo_urls) && profile.portfolio_photo_urls.length > 0,
    !!profile.business_name?.trim(),
    !!profile.insurance_policy_number?.trim(),
    !!profile.equipment_notes?.trim(),
    profile.years_experience != null && profile.years_experience >= 0,
    !!profile.vehicle_type?.trim(),
    (() => {
      const av = profile.availability;
      if (!av || typeof av !== "object") return false;
      return Object.values(av).some((v) => v === true);
    })(),
  ];
  const filled = checks.filter(Boolean).length;
  const total = checks.length;
  const percent = Math.round((filled / total) * 100);

  const missing: string[] = [];
  if (!checks[0]) missing.push("full name");
  if (!checks[1]) missing.push("phone");
  if (!checks[2]) missing.push("suburb");
  if (!checks[3]) missing.push("ABN");
  if (!checks[4]) missing.push("profile photo");
  if (!checks[5]) missing.push("bio");
  if (!checks[6]) missing.push("at least one specialty");
  if (!checks[7]) missing.push("portfolio photos");
  if (!checks[8]) missing.push("business name");
  if (!checks[9]) missing.push("insurance policy number");
  if (!checks[10]) missing.push("equipment notes");
  if (!checks[11]) missing.push("years of experience");
  if (!checks[12]) missing.push("vehicle type");
  if (!checks[13]) missing.push("availability");

  let message: string | null = null;

  const needsProfilePhoto = !checks[4];
  const needsPortfolio = !checks[7];

  if (needsProfilePhoto && needsPortfolio) {
    message = "Add a profile photo and portfolio photos to win more jobs!";
  } else if (needsProfilePhoto) {
    message = "Add a profile photo so listers can put a face to your work.";
  } else if (needsPortfolio) {
    message = "Add portfolio photos to showcase your best bond cleans.";
  } else if (missing.length > 0) {
    message = `Add ${missing
      .slice(0, 2)
      .join(", ")}${missing.length > 2 ? " and more" : ""} to win more jobs!`;
  }

  return { percent, message };
}
