/**
 * True for Google-hosted profile images (Next.js `Image` remotePatterns + OptimizedImage).
 */
export function isGooglePublicAvatarUrl(src: string | null | undefined): boolean {
  if (!src || typeof src !== "string") return false;
  try {
    const u = new URL(src);
    return u.protocol === "https:" && u.hostname.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}
