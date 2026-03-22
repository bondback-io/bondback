"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORT_CATEGORIES } from "@/lib/support-categorize";

type Props = {
  suggestedFilter: string;
  categoryFilter: string;
  statusFilter: string;
};

export function AdminSupportFilters({
  suggestedFilter,
  categoryFilter,
  statusFilter,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const buildHref = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === "all") p.delete(key);
    else p.set(key, value);
    const s = p.toString();
    return s ? `/admin/support?${s}` : "/admin/support";
  };

  const handleSuggested = (v: string) => router.push(buildHref("suggested", v));
  const handleCategory = (v: string) => router.push(buildHref("category", v));
  const handleStatus = (v: string) => router.push(buildHref("status", v));

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={suggestedFilter} onValueChange={handleSuggested}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="AI suggested" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All (AI suggested)</SelectItem>
          {SUPPORT_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={categoryFilter} onValueChange={handleCategory}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Final category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All (final)</SelectItem>
          {SUPPORT_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={handleStatus}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
