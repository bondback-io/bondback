import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  if (listing.lister_id !== session.user.id) {
    notFound();
  }

  redirect(`/my-listings?edit=${id}`);
}
