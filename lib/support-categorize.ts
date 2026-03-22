/**
 * AI-powered support ticket categorization.
 * Uses Groq (llama-3.3-70b or mixtral) or OpenAI, with keyword fallback if API fails.
 *
 * Env: GROQ_API_KEY or OPENAI_API_KEY (optional).
 */

export const SUPPORT_CATEGORIES = [
  "Dispute",
  "Technical",
  "Billing",
  "Feedback",
  "Other",
] as const;

/** User-facing category options for the Contact Support form. */
export const SUPPORT_CATEGORY_OPTIONS = [
  "Dispute with cleaner / lister",
  "Technical issue (app not working)",
  "Payment or earnings question",
  "How to use a feature",
  "Feedback or suggestion",
  "Other",
] as const;

/** Default subject line when user selects a category (for auto-fill). */
export const SUPPORT_CATEGORY_DEFAULT_SUBJECTS: Record<string, string> = {
  "Dispute with cleaner / lister": "Dispute or issue with a job",
  "Technical issue (app not working)": "Technical issue – app or page not working",
  "Payment or earnings question": "Question about payment or earnings",
  "How to use a feature": "How to use a feature",
  "Feedback or suggestion": "Feedback or suggestion",
  "Other": "Support request",
};

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export type CategorizeResult = {
  category: SupportCategory;
  confidence: number;
  reason?: string | null;
  source: "groq" | "openai" | "keyword";
};

const CATEGORY_REGEX = new RegExp(
  `\\b(${SUPPORT_CATEGORIES.join("|")})\\b`,
  "i"
);

/** Map API response categories (e.g. "Billing / Payments") to internal */
function normalizeCategory(raw: string): SupportCategory {
  const s = raw.trim();
  const m = s.match(CATEGORY_REGEX);
  if (m) {
    const cap = m[1];
    if (!cap) return "Other";
    return SUPPORT_CATEGORIES.find(
      (c) => c.toLowerCase() === cap.toLowerCase()
    ) ?? "Other";
  }
  const lower = s.toLowerCase();
  if (lower.includes("billing") || lower.includes("payment")) return "Billing";
  if (lower.includes("feedback") || lower.includes("suggestion")) return "Feedback";
  for (const c of SUPPORT_CATEGORIES) {
    if (c.toLowerCase() === lower) return c;
  }
  return "Other";
}

/** Expected JSON from AI: { category, confidence, reason } */
interface AIJsonResponse {
  category?: string;
  confidence?: number;
  reason?: string;
}

function parseAIJson(content: string): { category: SupportCategory; confidence: number; reason: string } | null {
  const trimmed = content.trim();
  const jsonStr = trimmed.replace(/^```json?\s*|\s*```$/g, "").trim();
  try {
    const parsed = JSON.parse(jsonStr) as AIJsonResponse;
    const category = normalizeCategory(parsed.category ?? "Other");
    const confidence = typeof parsed.confidence === "number"
      ? Math.min(100, Math.max(0, Math.round(parsed.confidence)))
      : 85;
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim().slice(0, 200) : "";
    return { category, confidence, reason };
  } catch {
    return null;
  }
}

/** Keyword-based fallback when AI is unavailable or fails */
function keywordCategorize(subject: string, description: string): CategorizeResult {
  const text = `${subject} ${description}`.toLowerCase();
  const words = text.split(/\s+/);

  const scores: Record<SupportCategory, number> = {
    Dispute: 0,
    Technical: 0,
    Billing: 0,
    Feedback: 0,
    Other: 0,
  };

  // Strong fallback: cleaning-quality and job-execution → Dispute; app/upload/crash → Technical
  const disputeTerms = [
    "dispute", "disputed", "complaint", "wrong", "unfair", "disagree", "not satisfied",
    "dirty", "unclean", "not clean", "poor quality", "missed", "damage", "broken item",
    "late arrival", "didn't show", "quality", "oven", "vacuum", "cleaning", "cleaner",
    "not vacuum", "photos not matching", "bond clean", "inspection",
  ];
  const technicalTerms = [
    "error", "bug", "broken", "not working", "crash", "crashes", "login", "password",
    "can't upload", "cannot upload", "upload failed", "failed", "loading", "upload",
    "photo upload", "app", "page", "notification", "notifications not working",
  ];
  const billingTerms = [
    "payment", "pay", "paid", "fee", "charge", "billing", "invoice", "subscription",
    "cost", "price", "charged", "payout", "earnings", "refund", "when will i get paid",
  ];
  const feedbackTerms = [
    "feedback", "suggestion", "feature", "improve", "idea", "love", "great",
    "recommend", "request", "would be nice", "ui", "ux", "praise",
  ];

  const textJoined = text.replace(/\s+/g, " ");
  for (const w of words) {
    if (disputeTerms.some((t) => w.includes(t) || t.includes(w))) scores.Dispute += 2;
    if (technicalTerms.some((t) => w.includes(t) || t.includes(w))) scores.Technical += 2;
    if (billingTerms.some((t) => w.includes(t) || t.includes(w))) scores.Billing += 2;
    if (feedbackTerms.some((t) => w.includes(t) || t.includes(w))) scores.Feedback += 2;
  }
  if (textJoined.includes("can't upload") || textJoined.includes("cannot upload")) scores.Technical += 3;
  if (textJoined.includes("not clean") || textJoined.includes("left") && textJoined.includes("dirty")) scores.Dispute += 3;
  if (textJoined.includes("oven") && (textJoined.includes("dirty") || textJoined.includes("clean"))) scores.Dispute += 2;

  const entries = Object.entries(scores) as [SupportCategory, number][];
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a), ["Other", 0] as [SupportCategory, number]);
  const category = best[1] > 0 ? best[0] : "Other";
  const confidence = best[1] > 0 ? 70 : 50;
  const reason = best[1] > 0 ? "Matched keywords in your message." : "No strong keyword match; choose manually if needed.";

  return { category, confidence, reason, source: "keyword" };
}

const SYSTEM_PROMPT = `You are an expert support triage assistant for Bond Back, an Australian bond cleaning marketplace.
Your job is to quickly and accurately categorize user support tickets.

Available categories:
- Dispute → cleaning quality issues, missed items, damage, late arrival, photos not matching
- Technical → app crashes, login problems, photo upload failures, notifications not working, bugs
- Billing → payment delays, fee questions, refund requests, payout issues
- Feedback → feature suggestions, UI/UX improvements, general praise or complaints
- Other → account questions, general enquiries, unrelated topics

Rules:
- Always return exactly one category.
- Be very strict: only use 'Dispute' if the ticket is clearly about the quality or execution of a cleaning job.
- Use 'Technical' for anything related to the app, website, or platform functionality.
- Analyze both subject and description.
- Consider Australian context (bond cleaning, real estate, rentals).

Return ONLY valid JSON in this exact format:
{
  "category": "Dispute" | "Technical" | "Billing" | "Feedback" | "Other",
  "confidence": 0-100,
  "reason": "one short sentence explaining your choice"
}

Few-shot examples:
Input: "The cleaner left my oven dirty and didn't vacuum properly"
Output: {"category": "Dispute", "confidence": 95, "reason": "Complaint about cleaning quality"}

Input: "I can't upload photos to my job"
Output: {"category": "Technical", "confidence": 90, "reason": "App functionality issue"}

Input: "When will I get paid for the last job?"
Output: {"category": "Billing", "confidence": 85, "reason": "Payment timing question"}

Now categorize this ticket:`;

function buildUserPrompt(subject: string, description: string): string {
  return `Subject: ${subject}\n\nDescription: ${description}`;
}

/** Call Groq chat completions (llama-3.3-70b or mixtral) */
async function categorizeWithGroq(
  subject: string,
  description: string
): Promise<CategorizeResult | null> {
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
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(subject, description) },
          ],
          max_tokens: 150,
          temperature: 0.1,
        }),
      });

      if (!res.ok) continue;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) continue;

      const parsed = parseAIJson(content);
      if (parsed) {
        return {
          category: parsed.category,
          confidence: parsed.confidence,
          reason: parsed.reason || null,
          source: "groq",
        };
      }
    } catch {
      // try next model
    }
  }
  return null;
}

/** Call OpenAI chat completions */
async function categorizeWithOpenAI(
  subject: string,
  description: string
): Promise<CategorizeResult | null> {
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
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(subject, description) },
        ],
        max_tokens: 150,
        temperature: 0.1,
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = parseAIJson(content);
    if (parsed) {
      return {
        category: parsed.category,
        confidence: parsed.confidence,
        reason: parsed.reason || null,
        source: "openai",
      };
    }
  } catch {
    // fall through
  }
  return null;
}

/** Minimum confidence to trust AI result; below this we use keyword fallback */
const MIN_AI_CONFIDENCE = 60;

/**
 * Categorize a support ticket from subject + description.
 * Groq first, then OpenAI. If AI fails or confidence < 60, use keyword fallback.
 */
export async function categorizeSupportTicket(
  subject: string,
  description: string
): Promise<CategorizeResult> {
  const sub = (subject ?? "").trim();
  const desc = (description ?? "").trim();
  if (!sub && !desc) {
    return { category: "Other", confidence: 0, reason: null, source: "keyword" };
  }

  const keywordFallback = keywordCategorize(sub, desc);

  const groq = await categorizeWithGroq(sub, desc);
  if (groq && groq.confidence >= MIN_AI_CONFIDENCE) return groq;

  const openai = await categorizeWithOpenAI(sub, desc);
  if (openai && openai.confidence >= MIN_AI_CONFIDENCE) return openai;

  return keywordFallback;
}
