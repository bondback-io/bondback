import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full rounded-md border border-input bg-background px-4 py-3 text-base shadow-sm transition-colors duration-200",
          "md:min-h-[80px] md:px-3 md:py-2 md:text-sm",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:ring-offset-gray-950",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

