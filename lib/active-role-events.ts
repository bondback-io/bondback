/** Fired after `profiles.active_role` changes so client nav (e.g. mobile bottom bar) can refetch. */
export const ACTIVE_ROLE_CHANGED_EVENT = "bondback:active-role-changed";

export function notifyActiveRoleChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACTIVE_ROLE_CHANGED_EVENT));
}
