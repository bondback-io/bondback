"use client";

import { signOutAndReloadApp } from "@/lib/auth/client-logout";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const handleSignOut = async () => {
    await signOutAndReloadApp({ redirectTo: "/login" });
  };

  return (
    <Button type="button" variant="ghost" onClick={handleSignOut}>
      Log out
    </Button>
  );
}
