"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "info" | "success" | "warning" | "destructive";
  }
>(({ className, variant = "default", ...props }, ref) => {
  const base =
    "relative w-full rounded-md border px-3 py-2 text-xs sm:text-sm";

  const variantClasses: Record<string, string> = {
    default:
      "border-border bg-muted/40 text-foreground dark:border-gray-700 dark:bg-gray-900/60",
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800/60 dark:bg-sky-900/40 dark:text-sky-100",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-900/40 dark:text-emerald-100",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/40 dark:text-amber-100",
    destructive:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-800/60 dark:bg-red-900/40 dark:text-red-100",
  };

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(base, variantClasses[variant], className)}
      {...props}
    />
  );
});
Alert.displayName = "Alert";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm leading-relaxed", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

export { Alert, AlertDescription, AlertTitle };

