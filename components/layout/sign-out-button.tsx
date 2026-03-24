"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { scheduleRouterAction } from "@/lib/deferred-router";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    scheduleRouterAction(() => router.push("/"));
  };

  return (
    <Button type="button" variant="ghost" onClick={handleSignOut}>
      Log out
    </Button>
  );
}
