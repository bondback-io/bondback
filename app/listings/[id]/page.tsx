import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildJobListingMetadata } from "@/app/jobs/[id]/page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return buildJobListingMetadata(id, { canonical: "listings" });
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/jobs/${id}`);
}
