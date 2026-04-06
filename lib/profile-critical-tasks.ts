import type { Database } from "@/types/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type CriticalTaskKey =
  | "phone"
  | "date_of_birth"
  | "profile_photo"
  | "insurance"
  | "abn";

export type CriticalTask = {
  key: CriticalTaskKey;
  /** Short label for UI */
  label: string;
  /** Hash on /profile (opens Personal info) */
  href: string;
};

function resolveRoleForTasks(
  activeRole: "lister" | "cleaner" | null,
  isCleaner: boolean,
  isLister: boolean
): "cleaner" | "lister" {
  if (activeRole === "cleaner") return "cleaner";
  if (activeRole === "lister") return "lister";
  if (isCleaner && !isLister) return "cleaner";
  if (isLister && !isCleaner) return "lister";
  return isCleaner ? "cleaner" : "lister";
}

/**
 * Role-specific “must complete” items for the My Account banner (not full profile %).
 * Excludes max travel — set at signup / edit profile as needed.
 */
export function getCriticalProfileTasks(
  profile: ProfileRow,
  opts: {
    activeRole: "lister" | "cleaner" | null;
    isCleaner: boolean;
    isLister: boolean;
  }
): {
  tasks: CriticalTask[];
  percent: number;
  /** One line under the progress bar */
  subtitle: string | null;
  role: "cleaner" | "lister";
} {
  const role = resolveRoleForTasks(opts.activeRole, opts.isCleaner, opts.isLister);

  const phoneOk = !!profile.phone?.trim();
  const dobOk = !!String(profile.date_of_birth ?? "").trim();
  const photoOk = !!profile.profile_photo_url?.trim();

  if (role === "lister") {
    const tasks: CriticalTask[] = [];
    if (!photoOk) {
      tasks.push({
        key: "profile_photo",
        label: "Profile photo",
        href: "#profile-photo",
      });
    }
    if (!phoneOk) {
      tasks.push({ key: "phone", label: "Mobile number", href: "#phone" });
    }
    if (!dobOk) {
      tasks.push({
        key: "date_of_birth",
        label: "Date of birth",
        href: "#date_of_birth",
      });
    }
    const total = 3;
    const done = total - tasks.length;
    const percent = Math.round((done / total) * 100);
    return {
      tasks,
      percent,
      subtitle:
        tasks.length === 0
          ? null
          : `${tasks.length} must-do${tasks.length === 1 ? "" : "s"} left`,
      role,
    };
  }

  const abnOk = (profile.abn ?? "").replace(/\D/g, "").length === 11;
  const insuranceOk = !!profile.insurance_policy_number?.trim();

  const tasks: CriticalTask[] = [];
  if (!photoOk) {
    tasks.push({
      key: "profile_photo",
      label: "Profile photo",
      href: "#profile-photo",
    });
  }
  if (!phoneOk) {
    tasks.push({ key: "phone", label: "Mobile number", href: "#phone" });
  }
  if (!dobOk) {
    tasks.push({
      key: "date_of_birth",
      label: "Date of birth",
      href: "#date_of_birth",
    });
  }
  if (!insuranceOk) {
    tasks.push({
      key: "insurance",
      label: "Insurance policy #",
      href: "#insurance_policy_number",
    });
  }
  if (!abnOk) {
    tasks.push({ key: "abn", label: "ABN", href: "#abn" });
  }

  const total = 5;
  const done = total - tasks.length;
  const percent = Math.round((done / total) * 100);

  return {
    tasks,
    percent,
    subtitle:
      tasks.length === 0
        ? null
        : `${tasks.length} must-do${tasks.length === 1 ? "" : "s"} left`,
    role,
  };
}
