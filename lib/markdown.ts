import { marked } from "marked";

/**
 * Convert Markdown to HTML for email template body.
 * If the string looks like existing HTML (starts with <), return as-is so we don't break HTML templates.
 */
export function markdownToHtml(md: string): string {
  const trimmed = md.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<")) return md;
  try {
    const out = marked.parse(trimmed);
    return typeof out === "string" ? out : String(out);
  } catch {
    return md;
  }
}
