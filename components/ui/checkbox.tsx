import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckboxProps = React.ComponentPropsWithoutRef<
  typeof CheckboxPrimitive.Root
>;

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-5 w-5 shrink-0 rounded-sm border border-input bg-background shadow-sm transition-colors duration-200 md:h-4 md:w-4",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:ring-offset-gray-950",
      "disabled:cursor-not-allowed disabled:opacity-60",
      "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-gray-800 dark:border-gray-700 dark:data-[state=checked]:bg-blue-600 dark:data-[state=checked]:text-white",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check className="h-3.5 w-3.5 md:h-3 md:w-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

