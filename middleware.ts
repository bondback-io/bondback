import type { NextRequest } from "next/server";
import { proxy, config as proxyConfig } from "./proxy";

export const config = proxyConfig;

/** Next.js entry — delegates to `proxy.ts` (apex→www, Supabase session, protected routes). */
export async function middleware(request: NextRequest) {
  return proxy(request);
}
