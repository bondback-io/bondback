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
  return <LoginForm {...buildLoginFormProps(sp)} />;
}
