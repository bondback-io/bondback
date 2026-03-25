"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import {
  banUser,
  unbanUser,
  adminDeleteUser,
  adminEditRole,
} from "@/lib/actions/admin-users";
import { useToast } from "@/components/ui/use-toast";
import {
  MoreVertical,
  User,
  Shield,
  Ban,
  CheckCircle,
  Trash2,
  AlertTriangle,
} from "lucide-react";

export type AdminUserActionsProps = {
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    is_banned?: boolean;
    is_deleted?: boolean;
    roles?: string[];
    active_role?: string | null;
    is_admin?: boolean;
  };
};

export function AdminUserActions({ user }: AdminUserActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [banStep1Open, setBanStep1Open] = useState(false);
  const [banStep2Open, setBanStep2Open] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banConfirm, setBanConfirm] = useState("");
  const [isBanning, setIsBanning] = useState(false);
  const [unbanOpen, setUnbanOpen] = useState(false);
  const [unbanConfirm, setUnbanConfirm] = useState("");
  const [isUnbanning, setIsUnbanning] = useState(false);
  const [deleteStep1Open, setDeleteStep1Open] = useState(false);
  const [deleteStep2Open, setDeleteStep2Open] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"lister" | "cleaner" | "admin">(
    user.is_admin ? "admin" : (user.active_role as "lister" | "cleaner") ?? "lister"
  );
  const [isSavingRole, setIsSavingRole] = useState(false);

  const name = user.full_name ?? "Unnamed user";
  const isBanned = !!user.is_banned;
  const isDeleted = !!user.is_deleted;

  const handleBan = async () => {
    if (banConfirm !== "BAN" || !banReason.trim()) return;
    setIsBanning(true);
    try {
      const result = await banUser(user.id, banReason.trim());
      setBanStep2Open(false);
      setBanConfirm("");
      setBanReason("");
      if (result.ok) {
        toast({ title: "User banned", description: `${name} has been banned.` });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } finally {
      setIsBanning(false);
    }
  };

  const handleUnban = async () => {
    if (unbanConfirm !== "UNBAN") return;
    setIsUnbanning(true);
    try {
      const result = await unbanUser(user.id);
      setUnbanOpen(false);
      setUnbanConfirm("");
      if (result.ok) {
        toast({ title: "User unbanned", description: `${name} can log in again.` });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } finally {
      setIsUnbanning(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== "DELETE") return;
    setIsDeleting(true);
    try {
      const result = await adminDeleteUser(user.id);
      setDeleteStep2Open(false);
      setDeleteConfirm("");
      if (result.ok) {
        toast({
          title: "User deleted",
          description: "All related data was removed and the auth account was deleted.",
        });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveRole = async () => {
    setIsSavingRole(true);
    try {
      const result = await adminEditRole(user.id, selectedRole);
      setEditRoleOpen(false);
      if (result.ok) {
        toast({ title: "Role updated", description: `${name} is now ${selectedRole}.` });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } finally {
      setIsSavingRole(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 dark:hover:bg-gray-800">
            <MoreVertical className="h-4 w-4" aria-label="Actions" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 dark:border-gray-800 dark:bg-gray-900">
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              router.push(`/cleaners/${user.id}`);
            }}
          >
            <User className="h-4 w-4" />
            View profile
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              router.push(`/admin/users/${user.id}`);
            }}
          >
            View details
          </DropdownMenuItem>
          <DropdownMenuSeparator className="dark:bg-gray-800" />
          <DropdownMenuItem onClick={() => setEditRoleOpen(true)} className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Edit role
          </DropdownMenuItem>
          {!isBanned ? (
            <DropdownMenuItem
              className="flex items-center gap-2 text-red-600 dark:text-red-400"
              onClick={() => {
                setBanReason("");
                setBanConfirm("");
                setBanStep1Open(true);
              }}
            >
              <Ban className="h-4 w-4" />
              Ban user
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="flex items-center gap-2"
              onClick={() => {
                setUnbanConfirm("");
                setUnbanOpen(true);
              }}
            >
              <CheckCircle className="h-4 w-4" />
              Unban user
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="dark:bg-gray-800" />
          <DropdownMenuItem
            className="flex items-center gap-2 text-red-600 dark:text-red-400"
            onClick={() => setDeleteStep1Open(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Ban step 1: reason + warning */}
      <Dialog open={banStep1Open} onOpenChange={setBanStep1Open}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Ban this user?</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Provide a reason. The user will be prevented from logging in and participating in jobs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ban-reason" className="dark:text-gray-300">Reason (required)</Label>
              <Textarea
                id="ban-reason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Repeated disputes, policy violation"
                rows={3}
                className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              />
            </div>
            <Alert variant="warning" className="text-xs">
              Banning prevents login and job participation. This is permanent unless reversed by an admin.
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanStep1Open(false)} className="dark:border-gray-700 dark:hover:bg-gray-800">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (banReason.trim()) {
                  setBanStep1Open(false);
                  setBanConfirm("");
                  setBanStep2Open(true);
                }
              }}
              disabled={!banReason.trim()}
              className="dark:bg-red-900 dark:hover:bg-red-800"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban step 2: type BAN */}
      <Dialog open={banStep2Open} onOpenChange={(o) => !o && setBanStep2Open(false)}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Final confirmation</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Type <strong>BAN</strong> to confirm banning <strong>{name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ban-confirm" className="dark:text-gray-300">Type BAN</Label>
            <Input
              id="ban-confirm"
              value={banConfirm}
              onChange={(e) => setBanConfirm(e.target.value.toUpperCase())}
              placeholder="BAN"
              className="font-mono dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanStep2Open(false)} className="dark:border-gray-700 dark:hover:bg-gray-800">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={banConfirm !== "BAN" || isBanning}
              onClick={handleBan}
              className="dark:bg-red-900 dark:hover:bg-red-800"
            >
              {isBanning ? "Banning…" : "Ban user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unban */}
      <Dialog open={unbanOpen} onOpenChange={(o) => !o && setUnbanOpen(false)}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Unban user?</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Type <strong>UNBAN</strong> to confirm: <strong>{name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="unban-confirm" className="dark:text-gray-300">Type UNBAN</Label>
            <Input
              id="unban-confirm"
              value={unbanConfirm}
              onChange={(e) => setUnbanConfirm(e.target.value.toUpperCase())}
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
              disabled={unbanConfirm !== "UNBAN" || isUnbanning}
              onClick={handleUnban}
              className="dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              {isUnbanning ? "Unbanning…" : "Unban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete step 1 */}
      <Dialog open={deleteStep1Open} onOpenChange={setDeleteStep1Open}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Permanently delete user?</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              This removes listings, jobs, bids, messages, notifications, and other data tied to this account,
              then deletes the user from Supabase Auth. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive" className="text-xs">
            Admin accounts cannot be deleted here — demote the user first. You cannot delete your own account.
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStep1Open(false)} className="dark:border-gray-700 dark:hover:bg-gray-800">
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

      {/* Delete step 2: type DELETE */}
      <Dialog open={deleteStep2Open} onOpenChange={(o) => !o && setDeleteStep2Open(false)}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Final confirmation</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Type <strong>DELETE</strong> to permanently remove <strong>{name}</strong> and their data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm" className="dark:text-gray-300">Type DELETE</Label>
            <Input
              id="delete-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value.toUpperCase())}
              placeholder="DELETE"
              className="font-mono dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStep2Open(false)} className="dark:border-gray-700 dark:hover:bg-gray-800">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== "DELETE" || isDeleting}
              onClick={handleDelete}
              className="dark:bg-red-900 dark:hover:bg-red-800"
            >
              {isDeleting ? "Deleting…" : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit role */}
      <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Edit role</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Set primary role for <strong>{name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="dark:text-gray-300">Role</Label>
            <div className="flex flex-wrap gap-2">
              {(["lister", "cleaner", "admin"] as const).map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={selectedRole === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedRole(r)}
                  className="capitalize dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleOpen(false)} className="dark:border-gray-700 dark:hover:bg-gray-800">
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={isSavingRole} className="dark:bg-gray-800 dark:hover:bg-gray-700">
              {isSavingRole ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
