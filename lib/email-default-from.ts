/**
 * Fallback `From` when `RESEND_FROM` is unset.
 *
 * Must be a real, monitored inbox: support ticket threads encourage “Reply”, and clients
 * address replies to the From domain. `noreply@bondback.io` is invalid until that address
 * exists and Resend verifies `bondback.io`.
 *
 * In production after verification, set `RESEND_FROM=Bond Back <noreply@bondback.io>` (or
 * keep a verified Gmail sender and set `RESEND_REPLY_TO` as needed).
 */
export const DEFAULT_RESEND_FROM = "Bond Back <bondback2026@gmail.com>";
