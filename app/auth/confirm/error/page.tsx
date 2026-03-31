import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function firstMessage(
  sp: Record<string, string | string[] | undefined>
): string {
  const v = sp.message;
  if (v === undefined) {
    return "We couldn’t confirm your email. The link may be expired or invalid.";
  }
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.trim() ? s : "We couldn’t confirm your email. The link may be expired or invalid.";
}

export default async function AuthConfirmErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const message = firstMessage(sp);

  return (
    <section className="page-inner flex min-h-[70vh] flex-col items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md border-border/80 shadow-lg dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Email confirmation
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Something went wrong with this link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-6">
          <p className="rounded-xl border border-border/80 bg-muted/40 px-4 py-4 text-center text-base leading-relaxed text-foreground dark:border-gray-700 dark:bg-gray-950/60 dark:text-gray-200">
            {message}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="min-h-12 w-full text-base font-semibold sm:flex-1" size="lg">
              <Link href="/signup">Back to sign up</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-12 w-full text-base sm:flex-1" size="lg">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            If you already confirmed your account, try logging in with your email and password.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
