import { getHelpArticles } from "@/lib/help-articles";
import { HelpPageClient } from "@/components/help/help-page-client";

export default async function HelpPage() {
  const initialArticles = await getHelpArticles();

  return <HelpPageClient initialArticles={initialArticles} />;
}
