"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AU_STATES } from "@/lib/au-suburbs";
import { setOnboardingDetails, type OnboardingRole } from "./onboarding-storage";
import { validateAbnIfRequired } from "@/lib/actions/validate-abn";
import { useAbnLiveValidation } from "@/hooks/use-abn-live-validation";
import {
  AbnValidationInputRow,
  AbnLiveValidationMessages,
} from "@/components/features/abn-validation-ui";
import { ArrowLeft } from "lucide-react";
import { FormSavingOverlay } from "@/components/ui/form-saving-overlay";

type Props = {
  role: OnboardingRole;
};

const defaultDetails = {
  full_name: "",
  phone: "",
  state: "QLD",
  suburb: "",
  postcode: "",
  abn: "",
};

export function DetailsFormClient({ role }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [, startDetailsTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(defaultDetails);

  const needsAbn = role === "cleaner" || role === "both";
  const abnLiveValidation = useAbnLiveValidation(needsAbn ? form.abn : "");

  const validate = (): boolean => {
    if (!form.full_name.trim()) {
      setError("Name is required.");
      return false;
    }
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 11) {
      setError("Enter a valid Australian phone (9–11 digits).");
      return false;
    }
    if (!form.suburb.trim()) {
      setError("Suburb is required.");
      return false;
    }
    if (needsAbn && form.abn.replace(/\D/g, "").length !== 11) {
      setError("ABN must be 11 digits.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    startDetailsTransition(() => setLoading(true));
    if (needsAbn && form.abn.replace(/\D/g, "").length === 11) {
      const result = await validateAbnIfRequired(form.abn);
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }
    }
    setOnboardingDetails({
      ...form,
      abn: needsAbn ? form.abn.replace(/\D/g, "") : "",
    });
    router.push("/onboarding/signup");
  };

  const title = role === "lister" ? "Your details" : role === "cleaner" ? "Cleaner details" : "Your details";
  const description =
    role === "lister"
      ? "We need a few details before you create your account."
      : "We need a few details and your ABN before you create your account.";

  return (
    <Card className="relative w-full max-w-md border-border dark:border-gray-800 dark:bg-gray-900">
      <FormSavingOverlay
        show={loading}
        variant="card"
        title="Saving your details…"
        description="Taking you to account creation."
      />
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl dark:text-gray-100">{title}</CardTitle>
        <CardDescription className="text-base dark:text-gray-400 md:text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5 md:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name" className="dark:text-gray-200">Full name</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              placeholder="Your name"
              className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="dark:text-gray-200">Phone (Australian)</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="e.g. 0412 345 678"
              className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="state" className="dark:text-gray-200">State</Label>
              <Select
                value={form.state}
                onValueChange={(v) => setForm((p) => ({ ...p, state: v }))}
              >
                <SelectTrigger id="state" className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AU_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="suburb" className="dark:text-gray-200">Suburb</Label>
              <Input
                id="suburb"
                value={form.suburb}
                onChange={(e) => setForm((p) => ({ ...p, suburb: e.target.value }))}
                placeholder="Suburb"
                className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcode" className="dark:text-gray-200">Postcode</Label>
              <Input
                id="postcode"
                value={form.postcode}
                onChange={(e) => setForm((p) => ({ ...p, postcode: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                placeholder="e.g. 4000"
                maxLength={4}
                className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              />
            </div>
          </div>
          {needsAbn && (
            <div className="space-y-2">
              <Label htmlFor="abn" className="dark:text-gray-200">ABN (11 digits)</Label>
              <AbnValidationInputRow
                id="abn"
                inputMode="numeric"
                maxLength={11}
                value={form.abn}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    abn: e.target.value.replace(/\D/g, "").slice(0, 11),
                  }))
                }
                placeholder="e.g. 12345678901"
                className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                validation={abnLiveValidation}
              />
              <AbnLiveValidationMessages
                validation={abnLiveValidation}
                detailsId="abn-validated-abn-details"
              />
              <p className="text-base text-muted-foreground dark:text-gray-400 md:text-xs">
                Required for cleaners. Verified against the Australian Business Register.
              </p>
            </div>
          )}
          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-base font-medium text-destructive dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 md:px-3 md:py-2 md:text-sm md:font-normal">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => router.push("/onboarding/role-choice")}
              className="h-12 min-h-[48px] w-full gap-2 dark:border-gray-700 dark:hover:bg-gray-800 sm:w-auto md:h-10 md:min-h-0"
            >
              <ArrowLeft className="h-5 w-5 md:h-4 md:w-4" />
              Back
            </Button>
            <Button type="submit" disabled={loading} size="lg" className="h-12 min-h-[48px] w-full dark:bg-gray-800 dark:hover:bg-gray-700 sm:w-auto md:h-10 md:min-h-0">
              {loading ? "Continuing…" : "Continue"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
