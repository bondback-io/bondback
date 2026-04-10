/**
 * SEO pack generation prompts (suburb landing + blog strategy + FAQ schema).
 * Model must return a single JSON object — no markdown fences.
 */

export const SEO_PACK_SYSTEM_PROMPT = `You are an Australian SEO copywriter for Bond Back (bondback.io), a marketplace where renters post bond cleaning jobs and cleaners bid (reverse auction).

Rules:
- Australian English; no unverified statistics or fake reviews.
- Output ONE JSON object only, no markdown code fences, no commentary.
- Keys and shapes must match the schema exactly.
- bodyMarkdown fields: plain Markdown only (headings ##, **bold**, lists, paragraphs). No HTML script tags.
- Three blog posts must be genuinely useful local SEO articles (titles unique per suburb).
- FAQ: 5–8 questions, answers under ~500 characters each.

JSON schema:
{
  "landing": {
    "heroTitle": string,
    "heroSubtitle": string,
    "sections": [{ "heading": string, "bodyMarkdown": string }]
  },
  "blogPosts": [
    { "slug": string, "title": string, "excerpt": string, "bodyMarkdown": string }
  ],
  "faq": { "questions": [{ "question": string, "answer": string }] },
  "metaTitle": string (≤70 chars),
  "metaDescription": string (≤160 chars)
}`;

export function buildSeoPackUserPrompt(input: {
  suburbName: string;
  postcode: string;
  state: string;
  regionName: string;
  pageSlug: string;
}): string {
  return `Generate the SEO content pack for this locality.

Locality:
- Suburb: ${input.suburbName}
- Postcode: ${input.postcode}
- State: ${input.state}
- Region label: ${input.regionName}
- URL slug (bond cleaning page path segment): ${input.pageSlug}

Landing page strategy:
- Hero speaks to renters comparing bond cleaning and end-of-lease cleaning in ${input.suburbName}.
- Include sections on: why compare bids, what bond cleaning typically covers, vacate timing tips (generic), and how Bond Back works (reverse auction, Australia-wide platform).
- Mention ${input.regionName} naturally where relevant for local SEO.

Blog strategy (exactly 3 posts):
- Mix: one "bond cleaning checklist / inspection" angle, one "end of lease timing" angle, one locality-focused "${input.suburbName} bond cleaning" angle.
- Each post: slug is lowercase-kebab-case, unique, starts with a word related to the topic.

FAQ schema:
- Questions renters in ${input.postcode} might ask about bond cleaning, end of lease cleaning, and using an online marketplace.

Return JSON only.`;
}
