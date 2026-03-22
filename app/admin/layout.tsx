import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/supabase/session";

/**
 * All /admin/* routes require an authenticated user with profiles.is_admin = true.
 * - Not logged in → redirect to home (/)
 * - Logged in but not admin → redirect to user dashboard (/dashboard)
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionWithProfile();

  if (!session) {
    redirect("/");
  }

  if (!session.isAdmin) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
