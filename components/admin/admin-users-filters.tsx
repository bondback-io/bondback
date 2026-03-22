"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type AdminUsersFiltersProps = {
  initialParams: {
    q?: string;
    role?: string;
    banned?: string;
    sort?: string;
    show_deleted?: string;
  };
  totalUsers: number;
  filteredCount: number;
};

export function AdminUsersFilters({
  initialParams,
  totalUsers,
  filteredCount,
}: AdminUsersFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialParams.q ?? "");
  const [role, setRole] = useState(initialParams.role ?? "all");
  const [status, setStatus] = useState(initialParams.banned ?? "all");

  const hasActiveFilters =
    (search && search.trim().length > 0) ||
    (role && role !== "all") ||
    (status && status !== "all");

  const applyParams = (next: Partial<AdminUsersFiltersProps["initialParams"]>) => {
    const current = new URLSearchParams(searchParams.toString());

    const merged: Record<string, string | undefined> = {
      q: next.q ?? search,
      role: next.role ?? (role === "all" ? "" : role),
      banned: next.banned ?? (status === "all" ? "" : status),
      sort: initialParams.sort,
      show_deleted: initialParams.show_deleted,
    };

    Object.entries(merged).forEach(([key, value]) => {
      if (value && value.length > 0) current.set(key, value);
      else current.delete(key);
    });

    const query = current.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    router.replace(url);
  };

  // Debounced search (300ms)
  useEffect(() => {
    const id = setTimeout(() => {
      startTransition(() => {
        applyParams({ q: search.trim() || undefined });
      });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleRoleChange = (value: string) => {
    setRole(value);
    startTransition(() => {
      applyParams({ role: value === "all" ? "" : value });
    });
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    startTransition(() => {
      if (value === "all") applyParams({ banned: "" });
      else applyParams({ banned: value });
    });
  };

  const handleClear = () => {
    setSearch("");
    setRole("all");
    setStatus("all");
    startTransition(() => {
      router.replace(pathname);
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex w-full flex-col gap-2 sm:max-w-md">
        <div className="flex items-center gap-2">
          <Input
            type="search"
            placeholder="Search by name, email or ABN"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-sm dark:bg-gray-800 dark:border-gray-700"
          />
          {isPending && (
            <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
              Updating…
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-semibold">
            {filteredCount.toLocaleString()} of {totalUsers.toLocaleString()}
          </span>{" "}
          users
          {hasActiveFilters && (
            <>
              {" "}
              · <span className="font-medium">filters active</span>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Role</span>
          <Select value={role} onValueChange={handleRoleChange}>
            <SelectTrigger className="h-8 w-28 text-xs dark:bg-gray-800 dark:border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="lister">Lister</SelectItem>
              <SelectItem value="cleaner">Cleaner</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Status</span>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-8 w-28 text-xs dark:bg-gray-800 dark:border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="no">Active</SelectItem>
              <SelectItem value="yes">Banned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="ml-auto h-8 px-2 text-[11px]"
          disabled={!hasActiveFilters && !initialParams.show_deleted}
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}

