/**
 * Reverse-auction rules shared by server actions and the bid form UI.
 * A single bid may lower the price by at most this many cents from the current lowest ($100 AUD).
 */
export const MAX_BID_DROP_PER_BID_CENTS = 10000;
