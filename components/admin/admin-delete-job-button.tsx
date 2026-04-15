"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { adminDeleteJob } from "@/lib/actions/admin-jobs";

export function AdminDeleteJobButton({ jobId }: { jobId: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteStep1Open, setDeleteStep1Open] = useState(false);
  const [deleteStep2Open, setDeleteStep2Open] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleteConfirm !== "DELETE") return;
    setIsDeleting(true);
    try {
      const formData = new FormData();
      formData.set("jobId", String(jobId));
      await adminDeleteJob(formData);
      setDeleteStep2Open(false);
      setDeleteConfirm("");
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
    <>
      <Button
        type="button"
        size="xs"
        variant="destructive"
        className="text-[11px]"
        onClick={() => setDeleteStep1Open(true)}
        disabled={isDeleting}
      >
        {isDeleting ? "Deleting…" : "Delete"}
      </Button>

      <Dialog open={deleteStep1Open} onOpenChange={setDeleteStep1Open}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Permanently delete job?</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              This removes the job and its messages. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteStep1Open(false)}
              className="dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteStep1Open(false);
                setDeleteConfirm("");
                setDeleteStep2Open(true);
              }}
              className="dark:bg-red-900 dark:hover:bg-red-800"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteStep2Open} onOpenChange={(o) => !o && setDeleteStep2Open(false)}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Final confirmation</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Type <strong>DELETE</strong> to permanently remove this job and its messages.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-job-confirm" className="dark:text-gray-300">
              Type DELETE
            </Label>
            <Input
              id="delete-job-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value.toUpperCase())}
              placeholder="DELETE"
              className="font-mono dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteStep2Open(false)}
              className="dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== "DELETE" || isDeleting}
              onClick={handleDelete}
              className="dark:bg-red-900 dark:hover:bg-red-800"
            >
              {isDeleting ? "Deleting…" : "Delete job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
