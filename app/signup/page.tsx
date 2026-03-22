import { redirect } from "next/navigation";

/**
 * Entry point for new users: redirect to role choice first (no auth yet).
 * The actual signup form is at /onboarding/signup after role + details are collected.
 */
export default function SignupPage() {
  redirect("/onboarding/role-choice");
}
