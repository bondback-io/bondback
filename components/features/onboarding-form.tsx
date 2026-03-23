"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { saveOnboardingProfile } from "@/lib/actions/onboarding";
import { validateAbnIfRequired } from "@/lib/actions/validate-abn";
import { useAbnLiveValidation } from "@/hooks/use-abn-live-validation";
import {
  AbnValidationInputRow,
  AbnLiveValidationMessages,
} from "@/components/features/abn-validation-ui";
import type { ProfileRole } from "@/lib/types";
import {
  AU_STATES,
  type AuStateCode,
  type SuburbEntry,
} from "@/lib/au-suburbs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const onboardingSchema = z.object({
  role: z.enum(["lister", "cleaner", "both"]),
  abn: z
    .string()
    .optional()
    .transform((value) => (value ?? "").trim())
    .refine(
      (value) => value === "" || /^\d{11}$/.test(value),
      "ABN must be 11 digits"
    ),
  date_of_birth: z.string().optional(),
  state: z.string().optional(),
  suburb: z.string().min(2, "Suburb is required"),
  postcode: z.string().optional(),
  max_travel_km: z.coerce
    .number()
    .min(1, "Minimum 1km")
    .max(200, "Maximum 200km")
    .optional()
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;

export type OnboardingFormProps = {
  userId: string;
  initialRole?: ProfileRole | null;
  initialAbn?: string | null;
  initialDateOfBirth?: string | null;
  initialSuburb?: string | null;
  initialPostcode?: string | null;
  initialMaxTravelKm?: number | null;
};

export const OnboardingForm = ({
  userId,
  initialRole,
  initialAbn,
  initialDateOfBirth,
  initialSuburb,
  initialPostcode,
  initialMaxTravelKm
}: OnboardingFormProps) => {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suburbSuggestions, setSuburbSuggestions] = useState<SuburbEntry[]>([]);
  const supabase = createBrowserSupabaseClient();

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      role: initialRole ?? "lister",
      abn: initialAbn ?? "",
      date_of_birth: initialDateOfBirth ?? "",
      state: "QLD",
      suburb: initialSuburb ?? "",
      postcode: initialPostcode ?? "",
      max_travel_km: initialMaxTravelKm ?? 30
    }
  });

  const watchRole = form.watch("role");
  const abnWatch = form.watch("abn");
  const needsAbnField = watchRole === "cleaner" || watchRole === "both";
  const abnLiveValidation = useAbnLiveValidation(needsAbnField ? (abnWatch ?? "") : "");

  const onSubmit = async (values: OnboardingValues) => {
    setSubmitError(null);
    setIsSubmitting(true);

    if (values.role === "cleaner" || values.role === "both") {
      const abnClean = (values.abn ?? "").trim().replace(/\D/g, "");
      if (abnClean.length === 11) {
        const abrResult = await validateAbnIfRequired(abnClean);
        if (!abrResult.ok) {
          setSubmitError(abrResult.error);
          setIsSubmitting(false);
          return;
        }
      }
      const params = new URLSearchParams();
      params.set("suburb", values.suburb.trim());
      if (values.postcode?.trim()) params.set("postcode", values.postcode.trim());
      params.set("max_travel_km", String(values.max_travel_km ?? 30));
      if (values.abn?.trim()) params.set("abn", values.abn.trim());
      setIsSubmitting(false);
      router.replace(`/onboarding/cleaner?${params.toString()}`);
      return;
    }

    const maxTravelKm = 30;
    // cleaner / both already redirected above; only "lister" reaches here
    const roles: ProfileRole[] = ["lister"];

    const result = await saveOnboardingProfile({
      roles,
      active_role: "lister",
      abn: null,
      date_of_birth: values.date_of_birth?.trim() || null,
      suburb: values.suburb.trim(),
      postcode: values.postcode?.trim() ?? null,
      max_travel_km: maxTravelKm
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    router.replace("/dashboard");
  };

  return (
    <section className="page-inner flex justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Help us tailor Bond Back for you</CardTitle>
          <CardDescription>
            Choose whether you&apos;re listing a bond clean or doing the
            cleaning. We use this to show the right dashboard and listings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-6"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
          >
            <div className="space-y-2">
              <Label>What best describes you?</Label>
              <RadioGroup
                value={form.watch("role")}
                onValueChange={(value) =>
                  form.setValue("role", value as ProfileRole)
                }
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                <label className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm shadow-sm">
                  <RadioGroupItem value="lister" />
                  <span>
                    <span className="block font-medium">Lister</span>
                    <span className="block text-xs text-muted-foreground">
                      I&apos;m booking a bond clean for my place.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm shadow-sm">
                  <RadioGroupItem value="cleaner" />
                  <span>
                    <span className="block font-medium">Cleaner</span>
                    <span className="block text-xs text-muted-foreground">
                      I&apos;m a professional cleaner with an ABN.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm shadow-sm">
                  <RadioGroupItem value="both" />
                  <span>
                    <span className="block font-medium">Both</span>
                    <span className="block text-xs text-muted-foreground">
                      I want to list jobs and also clean.
                    </span>
                  </span>
                </label>
              </RadioGroup>
              {form.formState.errors.role && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.role.message}
                </p>
              )}
            </div>

            {(watchRole === "cleaner" || watchRole === "both") && (
              <div className="space-y-2">
                <Label htmlFor="abn">ABN (11 digits)</Label>
                <Controller
                  name="abn"
                  control={form.control}
                  render={({ field }) => (
                    <AbnValidationInputRow
                      id="abn"
                      inputMode="numeric"
                      maxLength={11}
                      validation={abnLiveValidation}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                        field.onChange(digits);
                      }}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  )}
                />
                <AbnLiveValidationMessages
                  validation={abnLiveValidation}
                  detailsId="abn-validated-abn-details"
                />
                {form.formState.errors.abn && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.abn.message}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of birth (optional)</Label>
              <Input
                id="date_of_birth"
                type="date"
                {...form.register("date_of_birth")}
              />
              <p className="text-[11px] text-muted-foreground">
                We’ll send you a birthday message from Bond Back. We don’t share this.
              </p>
            </div>

            <div className="space-y-2">
              <Label>My location</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={form.watch("state") ?? ""}
                    onValueChange={(value) =>
                      form.setValue("state", value as AuStateCode)
                    }
                  >
                    <SelectTrigger id="state" className="w-full">
                      <SelectValue placeholder="Select state" />
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
                <div className="space-y-1 relative">
                  <Label htmlFor="suburb">Suburb</Label>
                  <Input
                    id="suburb"
                    {...form.register("suburb")}
                    onChange={(e) => {
                      const field = form.register("suburb");
                      field.onChange(e);
                      const value = e.target.value.trim();
                      if (value.length < 2) {
                        setSuburbSuggestions([]);
                        return;
                      }
                      const stateCode = (form.watch("state") ||
                        null) as AuStateCode | null;
                      supabase
                        .from("suburbs")
                        .select("suburb, postcode, state")
                        .ilike("suburb", `${value}%`)
                        .order("suburb")
                        .limit(8)
                        .then(({ data, error }) => {
                          if (error || !data) {
                            setSuburbSuggestions([]);
                            return;
                          }
                          const rows = data as SuburbEntry[];
                          const filtered = stateCode
                            ? rows.filter((s) => s.state === stateCode)
                            : rows;
                          setSuburbSuggestions(filtered);
                        });
                    }}
                  />
                  {form.formState.errors.suburb && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.suburb.message}
                    </p>
                  )}
                  {suburbSuggestions.length > 0 && (
                    <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover text-sm shadow-md dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100">
                      {suburbSuggestions.map((s) => (
                        <li
                          key={`${s.suburb}-${s.postcode}-${s.state}`}
                          className="cursor-pointer px-2 py-1 hover:bg-muted dark:hover:bg-gray-700"
                          onClick={() => {
                            form.setValue("suburb", s.suburb, {
                              shouldValidate: true,
                            });
                            form.setValue("postcode", s.postcode, {
                              shouldValidate: true,
                            });
                            setSuburbSuggestions([]);
                          }}
                        >
                          {s.suburb} {s.postcode} ({s.state})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    {...form.register("postcode")}
                  />
                  {form.formState.errors.postcode && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.postcode.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {(watchRole === "cleaner" || watchRole === "both") && (
              <div className="space-y-2">
                <Label htmlFor="max_travel_km">
                  How far can you travel? (km)
                </Label>
                <Input
                  id="max_travel_km"
                  type="number"
                  min={1}
                  max={200}
                  {...form.register("max_travel_km", { valueAsNumber: true })}
                />
                {form.formState.errors.max_travel_km && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.max_travel_km.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Cleaners typically travel up to 30km for metro areas.
                </p>
              </div>
            )}

            {submitError && (
              <p className="text-xs text-destructive">{submitError}</p>
            )}

            <CardFooter className="flex justify-end px-0 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save and continue"}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </section>
  );
};
