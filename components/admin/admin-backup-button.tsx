"use client";

import { useState } from "react";
import { exportAdminBackup } from "@/lib/actions/admin-backup";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ShieldAlert } from "lucide-react";

export function AdminBackupButton() {
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const result = await exportAdminBackup();
      if (!result.ok) {
        setError(result.error ?? "Backup failed.");
        setIsExporting(false);
        return;
      }

      const backupData = result.backup;
      const json = JSON.stringify(backupData, null, 2);
      const blob = new Blob([json], { type: "application/json" });

      const date = new Date();
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const filename = `bondback-backup-${yyyy}-${mm}-${dd}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setOpen(false);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred during backup."
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 border-amber-300 text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-900/40"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Download Database Backup</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            Creates a one-off JSON snapshot of key tables.{" "}
            <strong>Backups are not automatic.</strong> Run regularly and store securely.
          </TooltipContent>
        </Tooltip>

        {error && (
          <Alert variant="destructive" className="mt-1 border-red-300 bg-red-50 text-xs dark:border-red-900/60 dark:bg-red-950/30">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Dialog open={open} onOpenChange={(o) => !isExporting && setOpen(o)}>
          <DialogContent className="max-w-md dark:bg-gray-900 dark:border-gray-800">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">
                Export database snapshot
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm dark:text-gray-400">
                This will generate a JSON backup of core tables (profiles, listings, jobs,
                bids, notifications) and download it to your device.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Alert className="border-amber-300 bg-amber-50 text-xs dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertDescription>
                  Backups are <strong>not automatic</strong>. Run this regularly and store
                  the file securely. Avoid syncing backups to public or shared locations.
                </AlertDescription>
              </Alert>
              {/* TODO: integrate Supabase Management API or pg_dump via edge function */}
            </div>
            <DialogFooter className="mt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isExporting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5"
              >
                {isExporting && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                )}
                <span>{isExporting ? "Preparing backup…" : "Export & Download"}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

