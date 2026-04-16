export function ticketDisplayId(uuid: string): string {
  const compact = uuid.replace(/-/g, "").toUpperCase();
  const slice = compact.slice(0, 10);
  const n = Number.parseInt(slice || "0", 16);
  const padded = String(Number.isFinite(n) ? n % 1000000 : 0).padStart(6, "0");
  return `BB-${padded}`;
}

/** Stable token appended to email subjects so inbound replies map to a ticket reliably. */
export function supportTicketEmailToken(ticketId: string): string {
  return `[TICKET:${String(ticketId).trim()}]`;
}
