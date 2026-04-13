import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { SupportForm } from "@/components/support/support-form";
import { getSupportContactEmail } from "@/lib/support-contact-email";
import { ChevronLeft } from "lucide-react";

type SupportPageProps = {
  searchParams?: Promise<{ jobId?: string; listingId?: string }>;
};

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const session = await getSessionWithProfile();
  if (!session) {
    redirect("/login?redirectTo=/support");
  }

  const params = await searchParams;
  const jobId = params?.jobId ?? "";
  const listingId = params?.listingId ?? "";
  const initialEmail = session.user.email ?? "";
  const supportContactEmail = getSupportContactEmail();

  return (
    <section className="page-inner space-y-6">
      <Link
        href="/help"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Help
      </Link>
      <SupportForm
        initialEmail={initialEmail}
        initialJobId={jobId}
        initialListingId={listingId}
      />
      <p className="text-center text-xs text-muted-foreground dark:text-gray-500">
        You can also email{" "}
        <a
          href={`mailto:${supportContactEmail}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {supportContactEmail}
        </a>
        .
      </p>
    </section>
  );
}
