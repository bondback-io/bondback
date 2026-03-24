import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type ListingLister = Pick<
  Database["public"]["Tables"]["listings"]["Row"],
  "id" | "lister_id"
>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("listings")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  const row = data as { title?: string | null } | null;
  const label = row?.title?.trim() || "listing";
  return {
    title: `Edit ${label}`,
    description: `Edit your bond cleaning listing on Bond Back — ${label}.`,
    alternates: { canonical: `/listings/${id}/edit` },
    robots: { index: false, follow: false },
  };
}

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, lister_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !listing) {
    notFound();
  }

  const listingRow = listing as ListingLister;

  if (listingRow.lister_id !== session.user.id) {
    notFound();
  }

  redirect(`/my-listings?edit=${id}`);
}
