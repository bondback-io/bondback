"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

/** Renders nothing; when mounted, shows an error toast for admin-only redirect and clears ?error=admin_only from URL. */
export function AdminOnlyToast() {
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    toast({
      variant: "destructive",
      title: "Access denied",
      description: "Admin access only. You do not have permission to view that page.",
    });
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    const clean = url.pathname + url.search;
    router.replace(clean, { scroll: false });
  }, [toast, router]);

  return null;
}
