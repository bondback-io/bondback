import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export type LabelProps = React.ComponentPropsWithoutRef<
  typeof LabelPrimitive.Root
>;

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-base font-medium leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200 md:text-sm md:leading-none",
      className
    )}
    {...props}
  />
));

Label.displayName = LabelPrimitive.Root.displayName;

