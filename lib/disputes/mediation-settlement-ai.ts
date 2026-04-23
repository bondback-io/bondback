/**
 * Optional AI suggestion for admin mediation refund (AUD cents from job escrow to lister).
 * Uses GROQ_API_KEY or OPENAI_API_KEY when set; otherwise a deterministic heuristic.
 */

export type MediationSettlementAiSource = "groq" | "openai" | "heuristic";

export type MediationSettlementAiResult = {
  refund_cents: number;
  rationale: string;
  source: MediationSettlementAiSource;
};

function clampRefund(agreedJobCents: number, refund: number): number {
  const agreed = Math.max(0, Math.round(agreedJobCents));
  return Math.min(Math.max(0, Math.round(refund)), agreed);
}

function heuristicSuggestion(params: {
  agreedAmountCents: number;
  proposedRefundCents: number | null;
  counterRefundCents: number | null;
}): MediationSettlementAiResult {
  const agreed = Math.max(0, params.agreedAmountCents);
  const proposed = Math.max(0, params.proposedRefundCents ?? 0);
  const counter = Math.max(0, params.counterRefundCents ?? 0);
  let ref = 0;
  if (proposed > 0 && counter > 0) {
    ref = Math.round((proposed + counter) / 2);
  } else if (proposed > 0) {
    ref = Math.round(proposed * 0.9);
  } else if (counter > 0) {
    ref = counter;
  } else {
    ref = Math.round(agreed * 0.12);
  }
  return {
    refund_cents: clampRefund(agreed, ref),
    rationale:
      "Rule-based suggestion (no AI API key): midpoint of both offers when present, otherwise ~90% of the lister ask, else ~12% of the agreed job payment.",
    source: "heuristic",
  };
}

function parseJsonRefund(content: string): { refund_cents?: number; rationale?: string } | null {
  const trimmed = content.trim().replace(/^```json?\s*|\s*```$/g, "").trim();
  try {
    const o = JSON.parse(trimmed) as { refund_cents?: unknown; rationale?: unknown };
    const refund =
      typeof o.refund_cents === "number" && Number.isFinite(o.refund_cents)
        ? Math.round(o.refund_cents)
        : undefined;
    const rationale = typeof o.rationale === "string" ? o.rationale.trim().slice(0, 500) : "";
    if (refund === undefined) return null;
    return { refund_cents: refund, rationale };
  } catch {
    return null;
  }
}

const SYSTEM = `You are a fair dispute assistant for an Australian bond-cleaning marketplace.
The lister paid an agreed job amount into escrow (agreed_amount_cents = job payment in AUD cents, excluding platform fee they paid separately).
You must suggest how many AUD cents of THAT job payment should be refunded to the lister; the cleaner receives the remainder after refund.

Output ONLY valid JSON: {"refund_cents": number, "rationale": string}
- refund_cents: integer, 0 <= refund_cents <= agreed_amount_cents
- rationale: one or two short sentences, neutral tone

Weigh: lister's stated issue severity, whether cleaner partially completed work, and the numeric asks already on file. Do not exceed agreed_amount_cents.`;

function buildUserPayload(params: {
  agreedAmountCents: number;
  proposedRefundCents: number | null;
  counterRefundCents: number | null;
  disputeReason: string | null;
}): string {
  return JSON.stringify({
    agreed_amount_cents: params.agreedAmountCents,
    lister_requested_refund_cents: params.proposedRefundCents,
    cleaner_counter_refund_cents: params.counterRefundCents,
    dispute_reason_excerpt: (params.disputeReason ?? "").slice(0, 1800),
  });
}

async function tryGroq(userContent: string): Promise<MediationSettlementAiResult | null> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) return null;
  const models = ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"];
  for (const model of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userContent },
          ],
          max_tokens: 220,
          temperature: 0.2,
        }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) continue;
      const parsed = parseJsonRefund(content);
      if (parsed && parsed.refund_cents !== undefined) {
        return {
          refund_cents: parsed.refund_cents,
          rationale: parsed.rationale || "Model suggestion.",
          source: "groq",
        };
      }
    } catch {
      // next model
    }
  }
  return null;
}

async function tryOpenAI(userContent: string): Promise<MediationSettlementAiResult | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        max_tokens: 220,
        temperature: 0.2,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    const parsed = parseJsonRefund(content);
    if (parsed && parsed.refund_cents !== undefined) {
      return {
        refund_cents: parsed.refund_cents,
        rationale: parsed.rationale || "Model suggestion.",
        source: "openai",
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function suggestMediationRefundCents(params: {
  agreedAmountCents: number;
  proposedRefundCents: number | null;
  counterRefundCents: number | null;
  disputeReason: string | null;
}): Promise<MediationSettlementAiResult> {
  const agreed = Math.max(0, Math.round(params.agreedAmountCents));
  const userContent = buildUserPayload(params);

  const groq = await tryGroq(userContent);
  if (groq) {
    return {
      ...groq,
      refund_cents: clampRefund(agreed, groq.refund_cents),
    };
  }
  const oai = await tryOpenAI(userContent);
  if (oai) {
    return {
      ...oai,
      refund_cents: clampRefund(agreed, oai.refund_cents),
    };
  }
  return heuristicSuggestion(params);
}
