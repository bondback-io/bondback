/**
 * Truthy `profiles.is_admin` — DB may store boolean or legacy text.
 */
export function profileFieldIsAdmin(is_admin: unknown): boolean {
  if (is_admin === true) return true;
  if (typeof is_admin === "string") {
    return ["true", "t", "yes", "1"].includes(is_admin.toLowerCase().trim());
  }
  return false;
}
