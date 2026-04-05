import type { Metadata } from "next";
import { ResendConfirmationForm } from "./resend-confirmation-form";

export const metadata: Metadata = {
  title: "Resend confirmation email",
  description: "Request a new Bond Back account confirmation link.",
};

export default function ResendConfirmationPage() {
  return <ResendConfirmationForm />;
}
