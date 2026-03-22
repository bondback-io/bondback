"use client";

// Legacy no-op component kept to satisfy old references in Next.js build output.
// All role status hints have been removed from the UI.

export type RoleStatusHintProps = {
  role: "lister" | "cleaner";
  className?: string;
};

export function RoleStatusHint(_: RoleStatusHintProps) {
  return null;
}

