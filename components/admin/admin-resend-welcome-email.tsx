"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { adminResendWelcomeEmail } from "@/lib/actions/admin-users";
import { useToast } from "@/components/ui/use-toast";
import { Mail } from "lucide-react";

type AdminResendWelcomeEmailProps = {
  userId: string;
};

export function AdminResendWelcomeEmail({ userId }: AdminResendWelcomeEmailProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        void adminResendWelcomeEmail(userId)
          .then((r) => {
            if (r.ok) {
              toast({ title: "Welcome email sent", description: "Check Resend logs and the user inbox." });
            } else {
              toast({
                variant: "destructive",
                title: "Could not send welcome email",
                description: r.error ?? "Unknown error",
              });
            }
          })
          .finally(() => setLoading(false));
      }}
    >
      <Mail className="h-3.5 w-3.5" />
      {loading ? "Sending…" : "Resend welcome email"}
    </Button>
  );
}
