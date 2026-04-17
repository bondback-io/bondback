/**
 * Short status line for the route progress UI (in-app navigations only).
 */
export function getNavigationLoadingLabel(pathname: string, search: string): string {
  const path = pathname.replace(/\/$/, "") || "/";
  const params = new URLSearchParams(search);

  if (path === "/dashboard") return "Opening Dashboard…";
  if (path === "/lister/dashboard") return "Opening Lister dashboard…";
  if (path === "/cleaner/dashboard") return "Opening Cleaner dashboard…";
  if (path === "/find-jobs" || path === "/jobs" || path.startsWith("/jobs/browse")) {
    return "Opening Find jobs…";
  }
  if (path.startsWith("/jobs/") && path !== "/jobs") return "Opening job…";
  if (path === "/my-listings") return "Opening My listings…";
  if (path.startsWith("/my-listings")) return "Opening My listings…";
  if (path === "/listings/new") return "Opening new listing…";
  if (path.startsWith("/listings/")) return "Opening listing…";
  if (path === "/messages") return "Opening Messages…";
  if (path.startsWith("/messages/")) return "Opening conversation…";
  if (path === "/notifications") return "Opening Notifications…";
  if (path === "/profile") return "Opening Profile…";
  if (path === "/settings") {
    const tab = params.get("tab");
    if (tab === "notifications") return "Opening notification settings…";
    if (tab === "privacy") return "Opening privacy settings…";
    return "Opening Settings…";
  }
  if (path === "/earnings") return "Opening Earnings…";
  if (path.startsWith("/admin")) {
    if (path.includes("global-settings")) return "Opening global settings…";
    if (path.includes("users")) return "Opening admin users…";
    if (path.includes("listings")) return "Opening admin listings…";
    if (path.includes("jobs")) return "Opening admin jobs…";
    if (path.includes("disputes")) return "Opening admin disputes…";
    if (path.includes("emails")) return "Opening email templates…";
    return "Opening Admin…";
  }
  if (path === "/onboarding" || path.startsWith("/onboarding/")) return "Continuing onboarding…";
  if (path === "/signup" || path === "/login") return "Loading…";
  return "Loading page…";
}
