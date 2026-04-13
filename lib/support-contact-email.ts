/**
 * User-facing support / contact email for mailto links and copy.
 *
 * Server: `SUPPORT_CONTACT_EMAIL` → `ADMIN_NOTIFICATION_EMAIL` → legacy default.
 * Client (error modals, etc.): `NEXT_PUBLIC_SUPPORT_CONTACT_EMAIL` → same legacy default.
 * Set `NEXT_PUBLIC_SUPPORT_CONTACT_EMAIL` to match `ADMIN_NOTIFICATION_EMAIL` so browser UI shows the admin inbox.
 */

const LEGACY_DEFAULT = "support@bondback.io";

export function getSupportContactEmail(): string {
  const explicit = process.env.SUPPORT_CONTACT_EMAIL?.trim();
  if (explicit) return explicit;
  const admin = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (admin) return admin;
  return LEGACY_DEFAULT;
}

/** For client components; only `NEXT_PUBLIC_*` vars are available in the browser bundle. */
export function getPublicSupportContactEmail(): string {
  const pub =
    process.env.NEXT_PUBLIC_SUPPORT_CONTACT_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_NOTIFICATION_EMAIL?.trim();
  if (pub) return pub;
  return LEGACY_DEFAULT;
}
