export type ProfileRole = "lister" | "cleaner";

export type ThemePreference = "light" | "dark" | "system";
export type DistanceUnitPref = "km" | "mi";

/** Session + profile for header/nav (safe to pass to client). */
export type SessionWithProfile = {
  user: { id: string; email?: string };
  profile:
    | {
        full_name: string | null;
        roles: ProfileRole[];
        activeRole: ProfileRole | null;
        profile_photo_url: string | null;
        theme_preference: ThemePreference;
        distance_unit: DistanceUnitPref;
      }
    | null;
  roles: ProfileRole[];
  activeRole: ProfileRole | null;
  /** True when profiles.is_admin = true for this user. */
  isAdmin?: boolean;
};

/** Vehicle type for cleaner profile */
export const VEHICLE_TYPES = [
  "Car",
  "Van",
  "Ute",
  "Truck",
  "Other",
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/** Specialty options for cleaners (multi-select) */
export const CLEANER_SPECIALTIES = [
  "Oven Cleaning",
  "Carpet Steam",
  "Windows",
  "End-of-Lease Expert",
  "Blinds",
  "Fridge/Pantry",
  "Wall Marks",
  "Balcony",
] as const;
export type CleanerSpecialty = (typeof CLEANER_SPECIALTIES)[number];

/** Weekday keys for availability */
export const AVAILABILITY_DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
export type AvailabilityDay = (typeof AVAILABILITY_DAYS)[number];

export type Profile = {
  id: string;
  roles: ProfileRole[];
  active_role: ProfileRole;
  abn: string | null;
  suburb: string;
  postcode: string | null;
  max_travel_km: number;
  full_name: string | null;
  phone: string | null;
  years_experience: number | null;
  vehicle_type: string | null;
  profile_photo_url: string | null;
  bio: string | null;
  specialties: string[] | null;
  portfolio_photo_urls: string[] | null;
  business_name: string | null;
  insurance_policy_number: string | null;
  availability: Record<string, boolean> | null;
  equipment_notes: string | null;
  created_at?: string;
  updated_at?: string;
};

