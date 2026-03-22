"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  Briefcase,
  AlertTriangle,
  Database,
  FileDown,
  BarChart3,
  ChevronRight,
  DollarSign,
  Bell,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminDeleteListingsByStatus, adminExportCsv, adminBackupStub } from "@/lib/actions/admin-dashboard";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export type SectionId =
  | "overview"
  | "listings"
  | "users"
  | "jobs"
  | "disputes"
  | "payments"
  | "notifications"
  | "settings";

type Stats = {
  totalUsers: number;
  totalListings: number;
  totalJobs: number;
  totalRevenueCents: number;
  activeListingsCount: number;
  pendingJobsCount: number;
  disputesCount: number;
};

const BACKUP_WARNING = "Ensure database is backed up before proceeding!";

export function AdminDashboardClient({
  stats,
  profileName,
}: {
  stats: Stats;
  profileName: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [section, setSection] = useState<SectionId>("overview");
  const [listingsStatus, setListingsStatus] = useState<"live" | "ended" | "all">("live");
  const [deleteStep1Open, setDeleteStep1Open] = useState(false);
  const [deleteStep2Open, setDeleteStep2Open] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const navItems: { id: SectionId; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { id: "listings", label: "Listings", icon: <ListChecks className="h-4 w-4" /> },
    { id: "jobs", label: "Jobs", icon: <Briefcase className="h-4 w-4" /> },
    { id: "disputes", label: "Disputes", icon: <AlertTriangle className="h-4 w-4" /> },
    { id: "payments", label: "Payments & payouts", icon: <DollarSign className="h-4 w-4" /> },
    { id: "notifications", label: "Notifications & emails", icon: <Bell className="h-4 w-4" /> },
    { id: "settings", label: "Settings & backups", icon: <Database className="h-4 w-4" /> },
  ];

  const openDeleteStep1 = () => setDeleteStep1Open(true);
  const closeDeleteStep1 = () => setDeleteStep1Open(false);
  const openDeleteStep2 = () => {
    closeDeleteStep1();
    setDeleteConfirmText("");
    setDeleteStep2Open(true);
  };
  const closeDeleteStep2 = () => {
    setDeleteStep2Open(false);
    setDeleteConfirmText("");
  };

  const handleDeleteListings = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setIsDeleting(true);
    try {
      const result = await adminDeleteListingsByStatus(listingsStatus);
      closeDeleteStep2();
      if (result.ok) {
        toast({ title: "Listings deleted", description: `${result.deleted} listing(s) removed.` });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async (type: "listings" | "jobs" | "users") => {
    setIsExporting(type);
    try {
      const result = await adminExportCsv(type);
      if (result.ok) {
        const blob = new Blob([result.data], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Export done", description: `Downloaded ${result.filename}` });
      } else {
        toast({ variant: "destructive", title: "Export failed", description: result.error });
      }
    } finally {
      setIsExporting(null);
    }
  };

  const handleBackupStub = async () => {
    const result = await adminBackupStub();
    if (result.ok) setBackupMessage(result.message);
    else toast({ variant: "destructive", title: "Error", description: result.error });
  };

  const handleListingsStatusChange = useCallback((v: string) => {
    setListingsStatus(v as "live" | "ended" | "all");
  }, []);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Sidebar */}
      <nav
        className="flex shrink-0 flex-row flex-wrap gap-2 border-b border-border pb-4 lg:w-56 lg:flex-col lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4 dark:border-gray-800"
        aria-label="Admin sections"
      >
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={section === item.id ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "justify-start gap-2 dark:hover:bg-gray-800 dark:hover:text-gray-100",
              section === item.id && "dark:bg-gray-800 dark:text-gray-100"
            )}
            onClick={() => setSection(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
            <ChevronRight className="ml-auto h-4 w-4 opacity-50 lg:hidden" />
          </Button>
        ))}
      </nav>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-6">
        {section === "overview" && (
          <>
            <Card className="border-border dark:border-gray-800 dark:bg-gray-900/80">
              <CardHeader>
                <CardTitle className="text-lg dark:text-gray-100">Overview</CardTitle>
                <p className="text-sm text-muted-foreground dark:text-gray-400">
                  Welcome, {profileName ?? "Admin"}. Use the sidebar to manage listings, users, jobs, and more.
                </p>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                  <p className="text-[11px] font-medium uppercase text-muted-foreground dark:text-gray-400">Users</p>
                  <p className="text-lg font-semibold dark:text-gray-100">{stats.totalUsers}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                  <p className="text-[11px] font-medium uppercase text-muted-foreground dark:text-gray-400">Listings</p>
                  <p className="text-lg font-semibold dark:text-gray-100">{stats.totalListings}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                  <p className="text-[11px] font-medium uppercase text-muted-foreground dark:text-gray-400">Jobs</p>
                  <p className="text-lg font-semibold dark:text-gray-100">{stats.totalJobs}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <p className="text-[11px] font-medium uppercase text-emerald-800 dark:text-emerald-200">Revenue</p>
                  <p className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                    ${(stats.totalRevenueCents / 100).toLocaleString("en-AU", { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {section === "listings" && (
          <Card className="border-border dark:border-gray-800 dark:bg-gray-900/80">
            <CardHeader>
              <CardTitle className="text-lg dark:text-gray-100">Listings Management</CardTitle>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Remove listings by status. Back up first – this cannot be undone.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label className="text-xs dark:text-gray-300">Status</Label>
                  <Select
                    defaultValue="live"
                    onValueChange={handleListingsStatusChange}
                  >
                    <SelectTrigger className="w-[140px] dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="live">live</SelectItem>
                      <SelectItem value="ended">ended</SelectItem>
                      <SelectItem value="all">all</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={openDeleteStep1}
                  className="dark:bg-red-900/80 dark:hover:bg-red-900"
                >
                  Remove Selected Listings
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {section === "users" && (
          <Card className="border-border dark:border-gray-800 dark:bg-gray-900/80">
            <CardHeader>
              <CardTitle className="text-lg dark:text-gray-100">Users</CardTitle>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Manage users: ban or delete. Ensure database is backed up before sensitive actions.
              </p>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="dark:border-gray-700 dark:hover:bg-gray-800">
                <Link href="/admin/users">Open Users table →</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {section === "jobs" && (
          <Card className="border-border dark:border-gray-800 dark:bg-gray-900/80">
            <CardHeader>
              <CardTitle className="text-lg dark:text-gray-100">Jobs</CardTitle>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Force complete or refund jobs. Back up before proceeding.
              </p>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="dark:border-gray-700 dark:hover:bg-gray-800">
                <Link href="/admin/jobs">Open Jobs table →</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {section === "disputes" && (
          <Card className="border-border dark:border-gray-800 dark:bg-gray-900/80">
            <CardHeader>
              <CardTitle className="text-lg dark:text-gray-100">Disputes</CardTitle>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Resolve disputes: approve or refund.
              </p>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="dark:border-gray-700 dark:hover:bg-gray-800">
                <Link href="/admin/disputes">Open Disputes →</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {section === "settings" && (
          <Card className="border-border dark:border-gray-800 dark:bg-gray-900/80">
            <CardHeader>
              <CardTitle className="text-lg dark:text-gray-100">Settings & backups</CardTitle>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Database backup and operational settings. Use Supabase Dashboard or CLI for production backups.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackupStub}
                className="dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Download Database Backup (stub)
              </Button>
              {backupMessage && (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
                  {backupMessage}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {section === "notifications" && (
          <Card className="border-border dark:border-gray-800 dark:bg-gray-900/80">
            <CardHeader>
              <CardTitle className="text-lg dark:text-gray-100">Notifications & emails</CardTitle>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Configure in-app notifications and email activity. Per-user email preferences live in Settings → Notifications.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <Link href="/notifications">Open notifications feed →</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <Link href="/admin/users">Per-user email logs & overrides →</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {section === "payments" && (
          <Card className="border-border dark:border-gray-800 dark:bg-gray-900/80">
            <CardHeader>
              <CardTitle className="text-lg dark:text-gray-100">Payments & payouts</CardTitle>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                View platform revenue and payout status. Detailed charts live in the Payments admin page.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <Link href="/admin/payments">Open Payments & payouts →</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <span className="text-xs">
                  Total fees (lifetime):{" "}
                  <span className="font-semibold">
                    ${(stats.totalRevenueCents / 100).toLocaleString("en-AU", { maximumFractionDigits: 0 })}
                  </span>
                </span>
              </Button>
            </CardContent>
          </Card>
        )}

        {section === "overview" && (
          <Card className="border-border dark:border-gray-800 dark:bg-gray-900/80">
            <CardHeader>
              <CardTitle className="text-lg dark:text-gray-100">Key stats</CardTitle>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Totals and revenue (fees).
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-[11px] font-medium uppercase text-muted-foreground dark:text-gray-400">Total users</p>
                <p className="text-xl font-semibold dark:text-gray-100">{stats.totalUsers}</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-[11px] font-medium uppercase text-muted-foreground dark:text-gray-400">Total listings</p>
                <p className="text-xl font-semibold dark:text-gray-100">{stats.totalListings}</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-[11px] font-medium uppercase text-muted-foreground dark:text-gray-400">Total jobs</p>
                <p className="text-xl font-semibold dark:text-gray-100">{stats.totalJobs}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
                <p className="text-[11px] font-medium uppercase text-emerald-800 dark:text-emerald-200">Revenue (fees)</p>
                <p className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">
                  ${(stats.totalRevenueCents / 100).toLocaleString("en-AU", { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 dark:border-sky-800 dark:bg-sky-950/40">
                <p className="text-[11px] font-medium uppercase text-sky-800 dark:text-sky-200">Active listings</p>
                <p className="text-xl font-semibold text-sky-900 dark:text-sky-100">{stats.activeListingsCount}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40">
                <p className="text-[11px] font-medium uppercase text-amber-800 dark:text-amber-200">Pending jobs</p>
                <p className="text-xl font-semibold text-amber-900 dark:text-amber-100">{stats.pendingJobsCount}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 dark:border-red-800 dark:bg-red-950/40">
                <p className="text-[11px] font-medium uppercase text-red-800 dark:text-red-200">Open disputes</p>
                <p className="text-xl font-semibold text-red-900 dark:text-red-100">{stats.disputesCount}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog 1: Are you sure? */}
      <Dialog open={deleteStep1Open} onOpenChange={setDeleteStep1Open}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Remove selected listings?</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              This will delete all listings with status &quot;{listingsStatus}&quot;. Back up first! This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            {BACKUP_WARNING}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteStep1} className="dark:border-gray-700 dark:hover:bg-gray-800">
              Cancel
            </Button>
            <Button variant="destructive" onClick={openDeleteStep2} className="dark:bg-red-900 dark:hover:bg-red-800">
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog 2: Type DELETE to confirm */}
      <Dialog open={deleteStep2Open} onOpenChange={(open) => !open && closeDeleteStep2()}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Final confirmation</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              This cannot be undone. Type <strong>DELETE</strong> below to confirm.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
            {BACKUP_WARNING}
          </p>
          <div className="space-y-2">
            <Label htmlFor="confirm-delete" className="dark:text-gray-300">Type DELETE</Label>
            <Input
              id="confirm-delete"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="font-mono dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteStep2} className="dark:border-gray-700 dark:hover:bg-gray-800">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== "DELETE" || isDeleting}
              onClick={handleDeleteListings}
              className="dark:bg-red-900 dark:hover:bg-red-800"
            >
              {isDeleting ? "Deleting…" : "Delete listings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
