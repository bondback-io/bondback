-- Add AI reason for support ticket categorization (from Groq/OpenAI JSON response).
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ai_reason text;

COMMENT ON COLUMN public.support_tickets.ai_reason IS 'Short reason from AI categorization (or keyword fallback).';
