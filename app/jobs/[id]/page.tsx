import type { Metadata } from "next";

/**
 * Diagnostic: minimal `/jobs/[id]` page to verify the dynamic segment runs (no data fetch).
 * Restore the full JobDetail implementation from git history when route is confirmed.
 */

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Job ${id} · Bond Back`, robots: { index: false, follow: true } };
}

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params;

  console.log("🚀 ROUTE HIT — Job ID:", id);
  console.log("✅ Dynamic route app/jobs/[id]/page.tsx is now executing");

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-xl border bg-card p-8 text-center">
          <h1 className="mb-4 text-4xl font-bold">Job Detail Page</h1>
          <p className="mb-8 text-2xl text-muted-foreground">
            Job ID: <span className="font-mono font-bold text-primary">{id}</span>
          </p>
          <p className="text-lg">This page is now rendering correctly.</p>
          <div className="mt-8 text-sm text-muted-foreground">
            If you see this message, the route is fixed.
            <br />
            Next step will be to add the real job data.
          </div>
        </div>
      </div>
    </div>
  );
}
