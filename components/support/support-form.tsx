"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  suggestSupportCategory,
  submitSupportTicket,
  uploadSupportAttachments,
  type SuggestCategoryResult,
} from "@/lib/actions/support";
import {
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_CATEGORY_DEFAULT_SUBJECTS,
} from "@/lib/support-categorize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Sparkles, Check, Upload, X, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ANALYZE_DEBOUNCE_MS = 700;
const MIN_DESCRIPTION_LENGTH = 50;
const MAX_ATTACHMENTS = 5;
const ACCEPT_FILES = "image/jpeg,image/png,image/webp,image/gif,application/pdf";

export type SupportFormProps = {
  /** Pre-filled from user profile */
  initialEmail?: string;
  /** From ?jobId= on URL */
  initialJobId?: string;
  /** From ?listingId= on URL */
  initialListingId?: string;
};

export function SupportForm({
  initialEmail = "",
  initialJobId = "",
  initialListingId = "",
}: SupportFormProps) {
  const { toast } = useToast();
  const [category, setCategory] = useState<string>(
    SUPPORT_CATEGORY_OPTIONS.at(-1) ?? "Other"
  );
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [jobId, setJobId] = useState(initialJobId);
  const [listingId, setListingId] = useState(initialListingId);
  const [files, setFiles] = useState<File[]>([]);
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const [suggestedConfidence, setSuggestedConfidence] = useState<number | null>(null);
  const [suggestedReason, setSuggestedReason] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [ticketDisplayId, setTicketDisplayId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setEmail((e) => e || initialEmail);
    setJobId((j) => j || initialJobId);
    setListingId((l) => l || initialListingId);
  }, [initialEmail, initialJobId, initialListingId]);

  useEffect(() => {
    setSubject(SUPPORT_CATEGORY_DEFAULT_SUBJECTS[category] ?? "Support request");
  }, [category]);

  const canAnalyze =
    (subject.trim().length > 0 || description.trim().length > 0) &&
    description.trim().length >= 10;
  const runSuggestion = useCallback(async () => {
    if (!canAnalyze) return;
    setSuggestionError(null);
    setAnalyzing(true);
    try {
      const result: SuggestCategoryResult = await suggestSupportCategory(subject, description);
      setAnalyzing(false);
      if (result.ok) {
        setSuggestedCategory(result.suggestion.category);
        setSuggestedConfidence(result.suggestion.confidence);
        setSuggestedReason(result.suggestion.reason ?? null);
        setSuggestionError(null);
      } else {
        setSuggestionError(result.error ?? "AI couldn't categorize – please select manually.");
        setSuggestedCategory(null);
        setSuggestedConfidence(null);
        setSuggestedReason(null);
      }
    } catch {
      setAnalyzing(false);
      setSuggestionError("AI couldn't categorize – please select manually.");
      setSuggestedCategory(null);
      setSuggestedConfidence(null);
      setSuggestedReason(null);
    }
  }, [subject, description, canAnalyze]);

  useEffect(() => {
    if (!canAnalyze) {
      setSuggestedCategory(null);
      setSuggestedConfidence(null);
      setSuggestedReason(null);
      setSuggestionError(null);
      return;
    }
    const t = setTimeout(runSuggestion, ANALYZE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [subject, description, canAnalyze, runSuggestion]);

  const handleAcceptSuggestion = () => {
    if (suggestedCategory) {
      const match = SUPPORT_CATEGORY_OPTIONS.find(
        (o) => o.toLowerCase().startsWith(suggestedCategory.toLowerCase())
      );
      if (match) setCategory(match);
      else setCategory("Other");
    }
  };

  const descriptionError =
    description.trim().length > 0 && description.trim().length < MIN_DESCRIPTION_LENGTH
      ? `Please enter at least ${MIN_DESCRIPTION_LENGTH} characters.`
      : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const allowed = selected.filter((f) => {
      const t = f.type?.toLowerCase() ?? "";
      return (
        t.startsWith("image/") ||
        t === "application/pdf"
      );
    });
    setFiles((prev) => {
      const next = [...prev, ...allowed].slice(0, MAX_ATTACHMENTS);
      return next;
    });
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      toast({
        variant: "destructive",
        title: "Description too short",
        description: `Please enter at least ${MIN_DESCRIPTION_LENGTH} characters.`,
      });
      return;
    }
    setSubmitting(true);
    let attachmentPaths: string[] = [];
    if (files.length > 0) {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const uploadResult = await uploadSupportAttachments(formData);
      if (!uploadResult.ok) {
        setSubmitting(false);
        toast({ variant: "destructive", title: "Upload failed", description: uploadResult.error });
        return;
      }
      attachmentPaths = uploadResult.paths;
    }
    const result = await submitSupportTicket(
      subject.trim(),
      description.trim(),
      category,
      suggestedCategory,
      suggestedConfidence,
      {
        email: email.trim() || undefined,
        jobId: jobId.trim() || undefined,
        listingId: listingId.trim() || undefined,
        attachmentPaths: attachmentPaths.length ? attachmentPaths : undefined,
        aiReason: suggestedReason ?? undefined,
      }
    );
    setSubmitting(false);
    if (result.ok) {
      setTicketDisplayId(result.ticketDisplayId);
      setSubmitSuccess(true);
      setSubject("");
      setDescription("");
      setCategory("Other");
      setSuggestedCategory(null);
      setSuggestedConfidence(null);
      setSuggestedReason(null);
      setFiles([]);
      toast({
        title: "Ticket submitted",
        description: `#${result.ticketDisplayId} – we'll reply within 24 hours.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Could not submit",
        description: result.error,
      });
    }
  };

  if (submitSuccess) {
    return (
      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <MessageCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground dark:text-gray-100">
                Ticket #{ticketDisplayId} submitted successfully
              </h2>
              <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
                We&apos;ll reply within 24 hours. A confirmation email has been sent to you.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSubmitSuccess(false)}>
                Submit another
              </Button>
              <Button asChild size="sm">
                <Link href="/help">Back to Help</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <CardHeader>
        <CardTitle className="text-xl font-semibold tracking-tight dark:text-gray-100">
          Contact Support
        </CardTitle>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Describe your issue and we&apos;ll get back to you within 24 hours.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="support-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger
                id="support-category"
                className="min-h-11 w-full dark:bg-gray-800 dark:border-gray-700"
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORT_CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              Choose the option that best fits your request.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-subject">Subject</Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your issue"
              required
              className="min-h-11 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              Auto-filled from category; you can edit it.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-description">Description</Label>
            <Textarea
              id="support-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your issue or question in detail (at least 50 characters)..."
              required
              minLength={MIN_DESCRIPTION_LENGTH}
              rows={5}
              className={cn(
                "min-h-[120px] dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500",
                descriptionError && "border-destructive focus-visible:ring-destructive"
              )}
            />
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              {description.trim().length > 0
                ? `${description.trim().length} / ${MIN_DESCRIPTION_LENGTH} characters minimum`
                : `Minimum ${MIN_DESCRIPTION_LENGTH} characters. Include any error messages or steps to reproduce.`}
            </p>
            {descriptionError && (
              <p className="text-xs text-destructive">{descriptionError}</p>
            )}
          </div>

          {analyzing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI is thinking…
            </div>
          )}

          {suggestionError && !analyzing && (
            <Alert variant="destructive" className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertDescription>{suggestionError}</AlertDescription>
            </Alert>
          )}

          {!analyzing && suggestedCategory != null && suggestedConfidence != null && (
            <Alert className="flex flex-col gap-2 border-sky-200 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                <span className="text-sm">
                  AI suggests:{" "}
                  <Badge variant="secondary">{suggestedCategory}</Badge>
                  <span className="text-muted-foreground">
                    {" "}({Math.round(suggestedConfidence)}%){suggestedReason ? ` – ${suggestedReason}` : ""}
                  </span>
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1"
                onClick={handleAcceptSuggestion}
              >
                <Check className="h-3.5 w-3.5" />
                Accept
              </Button>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="support-job-id">Job ID (optional)</Label>
              <Input
                id="support-job-id"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="e.g. 123"
                className="min-h-11 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-500">
                If this is about a specific job, add the job ID.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-listing-id">Listing ID (optional)</Label>
              <Input
                id="support-listing-id"
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                placeholder="e.g. listing UUID"
                className="min-h-11 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-500">
                If relevant, add the listing ID.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-email">Email</Label>
            <Input
              id="support-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="min-h-11 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              We&apos;ll send the confirmation and reply to this address.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Attachments (optional)</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/40 px-4 py-2 text-sm transition-colors hover:bg-muted/70 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:bg-gray-800">
                <Upload className="h-4 w-4" />
                <span>Choose photos or PDF</span>
                <input
                  type="file"
                  accept={ACCEPT_FILES}
                  multiple
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
              <span className="text-xs text-muted-foreground dark:text-gray-500">
                Up to {MAX_ATTACHMENTS} files, 5 MB each. Images or PDF.
              </span>
            </div>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800/50"
                  >
                    <span className="truncate">{f.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(i)}
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
            <Button
              type="submit"
              disabled={submitting || !!descriptionError || description.trim().length < MIN_DESCRIPTION_LENGTH}
              className="min-h-11 min-w-[140px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send Message"
              )}
            </Button>
            <Button type="button" variant="ghost" asChild className="min-h-11">
              <Link href="/help">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
