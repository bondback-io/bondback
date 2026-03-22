"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { banUser, unbanUser } from "@/lib/actions/admin-users";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const BACKUP_WARNING =
  "Ensure database is backed up before proceeding – this action is irreversible without admin reversal.";

type User = {
  id: string;
  full_name: string | null;
  is_banned?: boolean;
};

export function UserBanUnbanActions({
  user,
  className,
}: {
  user: User;
  className?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [banStep1Open, setBanStep1Open] = useState(false);
  const [banStep2Open, setBanStep2Open] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banConfirmText, setBanConfirmText] = useState("");
  const [isBanning, setIsBanning] = useState(false);
  const [unbanOpen, setUnbanOpen] = useState(false);
  const [unbanConfirmText, setUnbanConfirmText] = useState("");
  const [isUnbanning, setIsUnbanning] = useState(false);

  const displayName = user.full_name ?? "Unnamed user";
  const isBanned = !!user.is_banned;

  const openBanStep1 = () => {
    setBanReason("");
    setBanStep1Open(true);
  };
  const closeBanStep1 = () => setBanStep1Open(false);
  const openBanStep2 = () => {
    if (!banReason.trim()) return;
    setBanConfirmText("");
    closeBanStep1();
    setBanStep2Open(true);
  };
  const closeBanStep2 = () => {
    setBanStep2Open(false);
    setBanConfirmText("");
  };

  const handleBan = async () => {
    if (banConfirmText !== "BAN") return;
    setIsBanning(true);
    try {
      const result = await banUser(user.id, banReason.trim());
      closeBanStep2();
      if (result.ok) {
        toast({ title: "User banned", description: `${displayName} has been banned.` });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } finally {
      setIsBanning(false);
    }
  };

  const handleUnban = async () => {
    if (unbanConfirmText !== "UNBAN") return;
    setIsUnbanning(true);
    try {
      const result = await unbanUser(user.id);
      setUnbanOpen(false);
      setUnbanConfirmText("");
      if (result.ok) {
        toast({ title: "User unbanned", description: `${displayName} can log in again.` });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } finally {
      setIsUnbanning(false);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      <Button asChild size="xs" variant="outline" className="text-[11px]">
        <a href={`/profile?id=${user.id}`}>View</a>
      </Button>
      <Button asChild size="xs" variant="outline" className="text-[11px]">
        <a href={`/admin/users/${user.id}`}>Edit role</a>
      </Button>
      {!isBanned ? (
        <Button
          type="button"
          size="xs"
          variant="destructive"
          className="text-[11px] dark:bg-red-900/80 dark:hover:bg-red-900"
          onClick={openBanStep1}
        >
          Ban User
        </Button>
      ) : (
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="text-[11px] dark:border-gray-700 dark:hover:bg-gray-800"
          onClick={() => {
            setUnbanConfirmText("");
            setUnbanOpen(true);
          }}
        >
          Unban
        </Button>
      )}

      {/* Ban Dialog 1: Reason + warning */}
      <Dialog open={banStep1Open} onOpenChange={setBanStep1Open}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Ban this user?</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Provide a reason for the ban. The user will see this reason and be prevented from logging in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ban-reason" className="dark:text-gray-300">Reason (required)</Label>
              <Textarea
                id="ban-reason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Repeated disputes, Off-platform deals"
                rows={3}
                className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                required
              />
            </div>
            <Alert variant="warning" className="text-xs">
              Banning prevents login and job participation. This is permanent unless manually reversed.
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeBanStep1} className="dark:border-gray-700 dark:hover:bg-gray-800">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={openBanStep2}
              disabled={!banReason.trim()}
              className="dark:bg-red-900 dark:hover:bg-red-800"
            >
              Confirm Ban
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban Dialog 2: Type BAN to confirm */}
      <Dialog open={banStep2Open} onOpenChange={(o) => !o && closeBanStep2()}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Final confirmation</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Confirm ban for: <strong>{displayName}</strong> (ID: {user.id}). Type <strong>BAN</strong> below to confirm.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive" className="text-xs">
            {BACKUP_WARNING}
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="ban-confirm" className="dark:text-gray-300">Type BAN</Label>
            <Input
              id="ban-confirm"
              value={banConfirmText}
              onChange={(e) => setBanConfirmText(e.target.value)}
              placeholder="BAN"
              className="font-mono dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeBanStep2} className="dark:border-gray-700 dark:hover:bg-gray-800">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={banConfirmText !== "BAN" || isBanning}
              onClick={handleBan}
              className="dark:bg-red-900 dark:hover:bg-red-800"
            >
              {isBanning ? "Banning…" : "Ban user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unban Dialog */}
      <Dialog open={unbanOpen} onOpenChange={(o) => !o && setUnbanOpen(false)}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Unban user?</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Confirm unban for: <strong>{displayName}</strong> (ID: {user.id}). Type <strong>UNBAN</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="unban-confirm" className="dark:text-gray-300">Type UNBAN</Label>
            <Input
              id="unban-confirm"
              value={unbanConfirmText}
              onChange={(e) => setUnbanConfirmText(e.target.value)}
              placeholder="UNBAN"
              className="font-mono dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnbanOpen(false)} className="dark:border-gray-700 dark:hover:bg-gray-800">
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={unbanConfirmText !== "UNBAN" || isUnbanning}
              onClick={handleUnban}
              className="dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              {isUnbanning ? "Unbanning…" : "Unban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
