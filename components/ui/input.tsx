import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[48px] h-12 w-full rounded-md border border-input bg-background px-4 py-3 text-base shadow-sm transition-colors duration-200",
          "md:min-h-0 md:h-9 md:px-3 md:py-1 md:text-sm",
          "file:border-0 file:bg-transparent file:text-base file:font-medium file:dark:text-gray-100 md:file:text-sm",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
          "dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus-visible:ring-blue-500 dark:ring-offset-gray-950",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

