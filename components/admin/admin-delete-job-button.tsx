"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { adminDeleteJob } from "@/lib/actions/admin-jobs";

export function AdminDeleteJobButton({ jobId }: { jobId: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Permanently delete this job and its messages?")) return;
    setIsDeleting(true);
    try {
      const formData = new FormData();
      formData.set("jobId", String(jobId));
      await adminDeleteJob(formData);
      toast({ title: "Job deleted", description: "The job has been removed." });
      router.refresh();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Could not delete job.",
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
