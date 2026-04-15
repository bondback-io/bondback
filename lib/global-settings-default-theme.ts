/**
 * Parse `global_settings.default_site_theme` for layout / onboarding.
 * Kept outside `lib/actions/global-settings.ts` because that file is `"use server"`
 * and Next.js only allows async server-action exports there.
 */
export function parseDefaultSiteThemeFromSettings(
  row: { default_site_theme?: string | null } | null | undefined
): "light" | "dark" {
  const v = row?.default_site_theme;
  return v === "light" ? "light" : "dark";
}
