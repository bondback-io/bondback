import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getPostLoginDashboardPath,
  shouldUseRoleBasedPostLogin,
} from "@/lib/auth/post-login-redirect";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import { LoginForm, type LoginFormSearchProps } from "./login-form";

function searchParamsToQueryString(
  sp: Record<string, string | string[] | undefined>
): string {
  const u = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined) u.append(key, item);
      }
    } else {
      u.set(key, value);
    }
  }
  return u.toString();
}

function firstParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string | null {
  const v = sp[key];
  if (v === undefined) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function buildLoginFormProps(
  sp: Record<string, string | string[] | undefined>
): LoginFormSearchProps {
  return {
    queryString: searchParamsToQueryString(sp),
    nextParam: firstParam(sp, "next"),
    bannedParam: firstParam(sp, "banned"),
    bannedReason: firstParam(sp, "reason"),
    messageParam: firstParam(sp, "message"),
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("roles, active_role, is_banned, banned_reason")
      .eq("id", user.id)
      .maybeSingle();

    const row = profile as {
      is_banned?: boolean;
      banned_reason?: string | null;
    } | null;

    if (row?.is_banned) {
      await supabase.auth.signOut();
      const reason = row.banned_reason?.trim();
      const qs = new URLSearchParams();
      qs.set("banned", "1");
      if (reason) qs.set("reason", reason);
      redirect(`/login?${qs.toString()}`);
    }

    const nextRaw = firstParam(sp, "next");
    const sanitizedNext = sanitizeInternalNextPath(nextRaw);
    if (sanitizedNext && !shouldUseRoleBasedPostLogin(sanitizedNext)) {
      redirect(sanitizedNext);
    }

    redirect(getPostLoginDashboardPath(profile));
  }

  return <LoginForm {...buildLoginFormProps(sp)} />;
}
