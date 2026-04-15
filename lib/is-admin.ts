/**
 * Normalised `profiles.is_admin` — DB may use boolean, smallint (0/1), bigint, or legacy text.
 * Keep in sync with admin route checks: job detail and loaders use this; some admin pages use
 * truthy `is_admin` only — numeric `1` must count as admin here or `/jobs/[id]` 404s for admins.
 */
export function profileFieldIsAdmin(is_admin: unknown): boolean {
  if (is_admin === true) return true;
  if (typeof is_admin === "number" && is_admin === 1) return true;
  if (typeof is_admin === "bigint" && is_admin === 1n) return true;
  if (typeof is_admin === "string") {
    return ["true", "t", "yes", "1"].includes(is_admin.toLowerCase().trim());
  }
  return false;
}
