"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { adminDeleteListing } from "@/lib/actions/admin-listings";

export function AdminDeleteListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Permanently delete this listing and its jobs, messages and bids?")) return;
    setIsDeleting(true);
    try {
      const formData = new FormData();
      formData.set("listingId", listingId);
      await adminDeleteListing(formData);
      toast({ title: "Listing deleted", description: "The listing has been removed." });
      router.refresh();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Could not delete listing.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button
      type="button"
      size="xs"
      variant="destructive"
      className="text-[11px]"
      onClick={handleDelete}
      disabled={isDeleting}
    >
      {isDeleting ? "Deleting…" : "Delete"}
    </Button>
  );
}
