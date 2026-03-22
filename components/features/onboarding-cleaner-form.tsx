"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { saveOnboardingCleanerProfile } from "@/lib/actions/onboarding";
import { validateAbnIfRequired } from "@/lib/actions/validate-abn";
import { VEHICLE_TYPES, type VehicleType } from "@/lib/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const cleanerOnboardingSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .refine(
      (v) => v.replace(/\D/g, "").length >= 9 && v.replace(/\D/g, "").length <= 11,
      "Enter a valid Australian phone (9–11 digits)"
    ),
  date_of_birth: z.string().optional(),
  state: z.string().optional(),
  suburb: z.string().min(2, "Suburb is required"),
  postcode: z.string().optional(),
  max_travel_km: z.coerce
    .number()
    .min(1, "At least 1 km")
    .max(200, "At most 200 km"),
  years_experience: z.coerce.number().min(0, "Minimum 0").max(50, "Maximum 50"),
  vehicle_type: z.enum(VEHICLE_TYPES as unknown as [string, ...string[]]),
  abn: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || /^\d{11}$/.test(v), "ABN must be 11 digits"),
});

type CleanerOnboardingValues = z.infer<typeof cleanerOnboardingSchema>;

export type OnboardingCleanerFormProps = {
  initialSuburb?: string;
  initialPostcode?: string;
  initialMaxTravelKm?: number;
  initialAbn?: string;
};

export function OnboardingCleanerForm({
  initialSuburb = "",
  initialPostcode = "",
  initialMaxTravelKm = 30,
  initialAbn = "",
}: OnboardingCleanerFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suburbSuggestions, setSuburbSuggestions] = useState<SuburbEntry[]>([]);
  const supabase = createBrowserSupabaseClient();

  const form = useForm<CleanerOnboardingValues>({
    resolver: zodResolver(cleanerOnboardingSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      date_of_birth: "",
      state: "",
      suburb: initialSuburb,
      postcode: initialPostcode,
      max_travel_km: initialMaxTravelKm,
      years_experience: 0,
      vehicle_type: "Car",
      abn: initialAbn,
    },
  });

  const onSubmit = async (values: CleanerOnboardingValues) => {
    setSubmitError(null);
    setIsSubmitting(true);

    const abnClean = (values.abn ?? "").trim().replace(/\D/g, "");
    if (abnClean.length === 11) {
      const abrResult = await validateAbnIfRequired(abnClean);
      if (!abrResult.ok) {
        setSubmitError(abrResult.error);
        setIsSubmitting(false);
        return;
      }
    }

    const result = await saveOnboardingCleanerProfile({
      full_name: values.full_name,
      phone: values.phone.trim(),
      date_of_birth: values.date_of_birth?.trim() || null,
      suburb: values.suburb.trim(),
      postcode: values.postcode?.trim() || null,
      max_travel_km: values.max_travel_km,
      years_experience: values.years_experience,
      vehicle_type: values.vehicle_type as VehicleType,
      abn: values.abn && values.abn.length > 0 ? values.abn : null,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    router.replace("/jobs");
  };

  return (
    <section className="page-inner flex justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Cleaner profile</CardTitle>
          <CardDescription>
            Tell us a bit about yourself so listers can find you. You can add
            more details later in My Profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                autoComplete="name"
                {...form.register("full_name")}
              />
              {form.formState.errors.full_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.full_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone number (Australian)</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="04XX XXX XXX or 02 XXXX XXXX"
                {...form.register("phone")}
              />
              {form.formState.errors.phone && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>

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
                  <Controller
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="state">
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
                    )}
                  />
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
                    <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover text-sm shadow-md">
                      {suburbSuggestions.map((s) => (
                        <li
                          key={`${s.suburb}-${s.postcode}-${s.state}`}
                          className="cursor-pointer px-2 py-1 hover:bg-muted"
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

            <div className="space-y-2">
              <Label htmlFor="max_travel_km">Max travel (km)</Label>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="years_experience">Years of experience</Label>
              <Input
                id="years_experience"
                type="number"
                min={0}
                max={50}
                {...form.register("years_experience", { valueAsNumber: true })}
              />
              {form.formState.errors.years_experience && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.years_experience.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle_type">Vehicle type</Label>
              <Controller
                control={form.control}
                name="vehicle_type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="vehicle_type">
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="abn">ABN (11 digits, optional)</Label>
              <Input
                id="abn"
                inputMode="numeric"
                maxLength={11}
                {...form.register("abn")}
              />
              <p className="text-[11px] text-muted-foreground">
                Verified against the Australian Business Register when provided.
              </p>
              {form.formState.errors.abn && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.abn.message}
                </p>
              )}
            </div>

            {submitError && (
              <p className="text-xs text-destructive">{submitError}</p>
            )}

            <CardFooter className="flex justify-end px-0 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save and browse jobs"}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
