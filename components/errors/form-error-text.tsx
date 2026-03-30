import { cn } from "@/lib/utils";

type FormErrorTextProps = {
  id?: string;
  message: string | null | undefined;
  className?: string;
};

/**
 * Consistent inline validation / server error line for forms (non-alarming).
 */
export function FormErrorText({ id, message, className }: FormErrorTextProps) {
  if (!message?.trim()) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm leading-snug text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100",
        className
      )}
    >
      {message}
    </p>
  );
}
