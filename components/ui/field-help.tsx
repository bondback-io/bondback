"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type FieldHelpProps = {
  children: React.ReactNode;
  /** Accessible label for the trigger (e.g. "Property type help"). */
  label?: string;
  className?: string;
  contentClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
};

/**
 * Help hint that works on touch: tap the ? to open. (Radix Tooltip is hover-centric and is unreliable on mobile.)
 */
export function FieldHelp({
  children,
  label = "More information",
  className,
  contentClassName,
  side = "top",
  align = "start",
}: FieldHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 rounded-full text-muted-foreground outline-none ring-offset-background transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:text-gray-500 dark:hover:text-gray-300",
            className
          )}
          aria-label={label}
        >
          <HelpCircle className="h-5 w-5 md:h-4 md:w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className={cn("max-w-[min(100vw-2rem,20rem)] text-xs leading-relaxed", contentClassName)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
