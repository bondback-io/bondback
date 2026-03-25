"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

const resetSchema = z
  .object({
    password: z.string().min(6, "At least 6 characters"),
    confirm: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

type ResetValues = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setChecking(false);
    });
  }, []);

  const onSubmit = async (values: ResetValues) => {
    setError(null);
    setIsSubmitting(true);
    const supabase = createBrowserSupabaseClient();
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (updateError) {
        setError(updateError.message);
        setIsSubmitting(false);
        return;
      }
      await supabase.auth.signOut();
      router.replace("/login?message=password-reset");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setIsSubmitting(false);
    }
  };

  if (checking) {
    return (
      <section className="page-inner flex justify-center px-3 py-8">
        <div className="text-muted-foreground">Loading…</div>
      </section>
    );
  }

  if (!hasSession) {
    return (
      <section className="page-inner flex justify-center px-3 py-8">
        <Card className="w-full max-w-md border-border dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-xl dark:text-gray-100">Link invalid or expired</CardTitle>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Request a new password reset link and open it from the same browser.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/forgot-password">Request reset link</Link>
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="text-primary underline underline-offset-2">
                Back to log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="page-inner flex justify-center px-3 py-8">
      <Card className="w-full max-w-md border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl dark:text-gray-100">Set a new password</CardTitle>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Choose a password you haven&apos;t used here before.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {error && (
              <Alert variant="destructive" className="text-sm">
                {error}
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...form.register("confirm")}
              />
              {form.formState.errors.confirm && (
                <p className="text-xs text-destructive">{form.formState.errors.confirm.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Update password"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="text-primary underline underline-offset-2">
                Back to log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
