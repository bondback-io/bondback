import { NextResponse } from "next/server";

/** Lightweight Edge handler — keeps a small warm path; no DB / Node-only APIs. */
export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true });
}
