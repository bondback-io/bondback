import { redirect } from "next/navigation";

/** Old “job list view” URL — keep redirect for bookmarks. */
export default function MyListingsJobsLegacyRedirect() {
  redirect("/my-listings?tab=active");
}
