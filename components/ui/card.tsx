import * as React from "react";
import { cn } from "@/lib/utils";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = ({ className, ...props }: CardProps) => (
  <div
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      "dark:bg-gray-900 dark:border-gray-800 dark:text-gray-100 dark:shadow-xl",
      className
    )}
    {...props}
  />
);

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export const CardHeader = ({ className, ...props }: CardHeaderProps) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
);

export type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export const CardTitle = ({ className, ...props }: CardTitleProps) => (
  <h3
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
);

export type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export const CardDescription = ({
  className,
  ...props
}: CardDescriptionProps) => (
  <p
    className={cn("text-sm text-muted-foreground dark:text-gray-400", className)}
    {...props}
  />
);

export type CardContentProps = React.HTMLAttributes<HTMLDivElement>;

export const CardContent = ({ className, ...props }: CardContentProps) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
);

export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export const CardFooter = ({ className, ...props }: CardFooterProps) => (
  <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
);

