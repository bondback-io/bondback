"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";

/**
 * Server passes fetch error state; shows a destructive toast once on mount.
 */
export function AdminUsersFetchErrorToast({
  title,
  description,
}: {
  title: string;
  /** When null/empty, no toast is shown. */
  description: string | null | undefined;
}) {
  const { toast } = useToast();
  const shown = useRef(false);

  useEffect(() => {
    if (!description?.trim() || shown.current) return;
    shown.current = true;
    toast({ variant: "destructive", title, description });
  }, [title, description, toast]);

  return null;
}
