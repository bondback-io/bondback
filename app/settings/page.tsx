import { redirect } from "next/navigation";

/**
 * Legacy `/settings` — unified account page lives at `/profile`.
 * Preserves query params (tab, payments, session_id, export) for bookmarks and Stripe return URLs.
 */
export default async function SettingsRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const sp = (await Promise.resolve(searchParams ?? {})) as Record<string, string | string[] | undefined>;
  const qs = new URLSearchParams();

  const tab = typeof sp.tab === "string" ? sp.tab : undefined;
  const payments = typeof sp.payments === "string" ? sp.payments : undefined;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : undefined;
  const exportVal = sp.export;

  if (tab) qs.set("tab", tab);
  if (payments) qs.set("payments", payments);
  if (sessionId) qs.set("session_id", sessionId);
  if (exportVal === "1" || exportVal === "true") qs.set("export", "1");

  const q = qs.toString();
  redirect(`/profile${q ? `?${q}` : ""}`);
}
