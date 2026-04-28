import type { LucideIcon } from "lucide-react";
import { Building2, KeyRound, Repeat2, Sparkles } from "lucide-react";
import type { ServiceTypeKey } from "@/lib/service-types";

export type CreateListingServicePickerOption = {
  value: ServiceTypeKey;
  title: string;
  subtitle: string;
  icon: LucideIcon;
};

/** Same choices as the create-listing form service picker (keep in sync for UX). */
export const CREATE_LISTING_SERVICE_PICKER_OPTIONS: CreateListingServicePickerOption[] = [
  {
    value: "bond_cleaning",
    title: "Bond cleaning",
    subtitle: "End of lease & bond return",
    icon: KeyRound,
  },
  {
    value: "recurring_house_cleaning",
    title: "Recurring clean",
    subtitle: "Weekly, fortnightly, or monthly",
    icon: Repeat2,
  },
  {
    value: "airbnb_turnover",
    title: "Airbnb turnover",
    subtitle: "Short-stay & guest-ready",
    icon: Building2,
  },
  {
    value: "deep_clean",
    title: "Deep / spring clean",
    subtitle: "Deep, spring & inspection-ready cleans",
    icon: Sparkles,
  },
];
