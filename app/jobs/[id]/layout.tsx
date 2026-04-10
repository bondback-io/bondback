/**
 * `/jobs/[id]` inherits the root `app/layout.tsx` (header, theme, auth session provider).
 * No extra redirect here — job visibility is enforced in data loaders + `notFound()`.
 */
export default function JobsDynamicSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
