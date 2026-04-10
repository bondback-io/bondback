import { SEO_PACK_SYSTEM_PROMPT, buildSeoPackUserPrompt } from "@/lib/seo/seo-generation-prompts";
import { buildTemplateSeoBundle } from "@/lib/seo/seo-template-content";
import type { SeoBlogPost, SeoFaqPayload, SeoGeneratedBundle, SeoLandingPayload } from "@/lib/seo/seo-content-types";
import { logSeoError, logSeoWarn } from "@/lib/seo/seo-generation-logger";

function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeBundle(raw: unknown, fallback: SeoGeneratedBundle): SeoGeneratedBundle {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;

  const landingRaw = o.landing;
  let landing: SeoLandingPayload = fallback.landing;
  if (landingRaw && typeof landingRaw === "object") {
    const L = landingRaw as Record<string, unknown>;
    const sections: SeoLandingPayload["sections"] = [];
    if (Array.isArray(L.sections)) {
      for (const s of L.sections) {
        if (!s || typeof s !== "object") continue;
        const r = s as Record<string, unknown>;
        if (isNonEmptyString(r.heading) && isNonEmptyString(r.bodyMarkdown)) {
          sections.push({
            heading: r.heading.trim(),
            bodyMarkdown: sanitizeMarkdown(String(r.bodyMarkdown)),
          });
        }
      }
    }
    landing = {
      heroTitle: isNonEmptyString(L.heroTitle) ? String(L.heroTitle).trim() : fallback.landing.heroTitle,
      heroSubtitle: isNonEmptyString(L.heroSubtitle)
        ? String(L.heroSubtitle).trim()
        : fallback.landing.heroSubtitle,
      sections: sections.length > 0 ? sections : fallback.landing.sections,
    };
  }

  let blogPosts: SeoBlogPost[] = fallback.blogPosts;
  const rawBlogArr = o.blogPosts ?? o.blog_posts;
  if (Array.isArray(rawBlogArr)) {
    const posts: SeoBlogPost[] = [];
    for (const p of rawBlogArr) {
      if (!p || typeof p !== "object") continue;
      const r = p as Record<string, unknown>;
      if (
        isNonEmptyString(r.slug) &&
        isNonEmptyString(r.title) &&
        isNonEmptyString(r.bodyMarkdown)
      ) {
        posts.push({
          slug: kebabSlug(String(r.slug)),
          title: String(r.title).trim(),
          excerpt: isNonEmptyString(r.excerpt) ? String(r.excerpt).trim() : "",
          bodyMarkdown: sanitizeMarkdown(String(r.bodyMarkdown)),
        });
      }
    }
    if (posts.length > 0) blogPosts = posts.slice(0, 5);
  }

  let faq: SeoFaqPayload = fallback.faq;
  const faqRaw = o.faq;
  if (faqRaw && typeof faqRaw === "object") {
    const F = faqRaw as Record<string, unknown>;
    if (Array.isArray(F.questions)) {
      const qs: SeoFaqPayload["questions"] = [];
      for (const q of F.questions) {
        if (!q || typeof q !== "object") continue;
        const r = q as Record<string, unknown>;
        if (isNonEmptyString(r.question) && isNonEmptyString(r.answer)) {
          qs.push({
            question: String(r.question).trim(),
            answer: String(r.answer).trim().slice(0, 2000),
          });
        }
      }
      if (qs.length > 0) faq = { questions: qs };
    }
  }

  const metaTitle = isNonEmptyString(o.metaTitle)
    ? String(o.metaTitle).trim().slice(0, 70)
    : fallback.metaTitle;
  const metaDescription = isNonEmptyString(o.metaDescription)
    ? String(o.metaDescription).trim().slice(0, 160)
    : fallback.metaDescription;

  return { landing, blogPosts, faq, metaTitle, metaDescription };
}

function kebabSlug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeMarkdown(md: string): string {
  return md.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

async function chatJsonGroq(system: string, user: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key?.trim()) return null;
  const models = ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"];
  for (const model of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: 4096,
          temperature: 0.35,
        }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) return content;
    } catch (e) {
      logSeoWarn("groq model failed", { model, err: e instanceof Error ? e.message : String(e) });
    }
  }
  return null;
}

async function chatJsonOpenAI(system: string, user: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 4096,
        temperature: 0.35,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (e) {
    logSeoError("openai chat failed", e);
    return null;
  }
}

/**
 * Generate SEO pack via Groq → OpenAI → template fallback.
 */
export async function generateSeoPackWithAi(input: {
  suburbName: string;
  postcode: string;
  state: string;
  regionName: string;
  pageSlug: string;
}): Promise<SeoGeneratedBundle> {
  const fallback = buildTemplateSeoBundle(input);
  const user = buildSeoPackUserPrompt({
    suburbName: input.suburbName,
    postcode: input.postcode,
    state: input.state,
    regionName: input.regionName,
    pageSlug: input.pageSlug,
  });

  let rawText: string | null = await chatJsonGroq(SEO_PACK_SYSTEM_PROMPT, user);
  if (!rawText) rawText = await chatJsonOpenAI(SEO_PACK_SYSTEM_PROMPT, user);
  if (!rawText) {
    logSeoWarn("no AI keys or empty response — using template bundle", { pageSlug: input.pageSlug });
    return fallback;
  }

  try {
    const parsed = JSON.parse(stripFences(rawText)) as unknown;
    return normalizeBundle(parsed, fallback);
  } catch (e) {
    logSeoError("failed to parse AI JSON — using template", e, { pageSlug: input.pageSlug });
    return fallback;
  }
}

export { sanitizeMarkdown, normalizeBundle };
