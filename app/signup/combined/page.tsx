import { permanentRedirect } from "next/navigation";

/** Legacy URL — combined sign-up is the default at `/signup`. */
export default function CombinedSignupRedirectPage() {
  permanentRedirect("/signup");
}
