"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Must be rendered inside a `<form>` that uses a Server Action. */
export function DisputeSubmitButton({
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className={className} disabled={pending || !!disabled} {...props}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          Working…
        </>
      ) : (
        children
      )}
    </Button>
  );
}
