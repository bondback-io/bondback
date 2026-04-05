"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    queryClient.clear();
    /** Full document load matches account menu logout — avoids stale RSC + React Query user state. */
    window.location.assign("/login");
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full gap-2 h-12 min-h-[48px] w-full text-base border-border dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800/90 md:h-8 md:min-h-0 md:w-auto md:text-xs"
      onClick={handleLogout}
    >
      <LogOut className="h-5 w-5 md:h-3.5 md:w-3.5" />
      Log out
    </Button>
  );
}
