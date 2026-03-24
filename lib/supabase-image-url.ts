/**
 * True for public Supabase Storage object URLs (Next.js Image `remotePatterns` / optimization).
 */
export function isSupabasePublicImageUrl(src: string | null | undefined): boolean {
  if (!src || typeof src !== "string") return false;
  try {
    const u = new URL(src);
    return (
      u.protocol === "https:" &&
      u.hostname.endsWith(".supabase.co") &&
      u.pathname.includes("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}
