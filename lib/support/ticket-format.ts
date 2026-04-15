export function ticketDisplayId(uuid: string): string {
  const hex = uuid.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `TKT-${hex}`;
}

/** Stable token appended to email subjects so inbound replies map to a ticket reliably. */
export function supportTicketEmailToken(ticketId: string): string {
  return `[TICKET:${String(ticketId).trim()}]`;
}
