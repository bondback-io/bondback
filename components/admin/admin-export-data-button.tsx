"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { adminExportCsv } from "@/lib/actions/admin-dashboard";

const EXPORT_OPTIONS: { type: "users" | "listings" | "jobs"; label: string }[] = [
  { type: "users", label: "Users (CSV)" },
  { type: "listings", label: "Listings (CSV)" },
  { type: "jobs", label: "Jobs (CSV)" },
];

export function AdminExportDataButton() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (type: "users" | "listings" | "jobs") => {
    setExporting(type);
    try {
      const result = await adminExportCsv(type);
      if (result.ok) {
        const blob = new Blob([result.data], { type: "text/csv;charset=utf-8" });
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
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
          disabled={!!exporting}
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileDown className="h-3.5 w-3.5" />
          )}
          Export Data
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 dark:border-gray-800 dark:bg-gray-900">
        {EXPORT_OPTIONS.map(({ type, label }) => (
          <DropdownMenuItem
            key={type}
            onClick={() => handleExport(type)}
            disabled={!!exporting}
            className="text-xs"
          >
            {exporting === type ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Exporting…
              </span>
            ) : (
              label
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
