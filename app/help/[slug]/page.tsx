import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getArticleBySlug } from "@/lib/help-articles";
import { markdownToHtml } from "@/lib/markdown";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";

/** Article body — ISR aligned with help index. */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) {
    return { title: "Help article" };
  }
  const title = article.title;
  const description = `${article.title} — Bond Back help centre for bond cleaning and end of lease cleaning in Australia.`;
  return {
    title,
    description,
    alternates: { canonical: `/help/${slug}` },
    openGraph: {
      title: `${title} · Bond Back Help`,
      description,
      url: `/help/${slug}`,
    },
  };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const html = markdownToHtml(article.content ?? "");

  return (
    <section className="page-inner space-y-6">
      <Link
        href="/help"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Help
      </Link>

      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="space-y-2">
          <Badge variant="outline" className="w-fit">
            {article.category}
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-gray-100">
            {article.title}
          </h1>
        </CardHeader>
        <CardContent>
          <div
            className="help-article-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </CardContent>
      </Card>
    </section>
  );
}
