import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 ring-offset-background dark:ring-offset-gray-950",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500",
        success:
          "bg-emerald-600 !text-white hover:bg-emerald-700 hover:!text-white dark:bg-emerald-600 dark:!text-white dark:hover:bg-emerald-500 dark:hover:!text-white",
        outline:
          "border border-input bg-background hover:bg-muted hover:text-foreground dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100",
        ghost:
          "hover:bg-muted hover:text-foreground dark:hover:bg-gray-800 dark:text-gray-100",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800",
        link:
          "text-primary underline-offset-4 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
      },
      size: {
        default: "h-9 px-4 py-2",
        xs: "h-7 rounded-md px-2 py-1 text-[11px]",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 min-h-[48px] rounded-md px-6 text-base md:h-10 md:min-h-0 md:text-sm",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

