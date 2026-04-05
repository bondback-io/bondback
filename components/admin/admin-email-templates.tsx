"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { EMAIL_TEMPLATE_TYPES, getEmailTypeLabel, getSampleDataForType } from "@/lib/admin-email-templates-utils";
import { getDefaultTemplate } from "@/lib/default-email-templates";
import {
  getTestSendRateLimit,
  getTestUserProfileForPreview,
  saveEmailTemplate,
  toggleEmailType,
  createEmailTemplate,
  sendTestEmailWithContent,
  applyDefaultEmailTemplates,
} from "@/lib/actions/admin-email-templates";
import type {
  EmailTemplatesData,
  TestSendRateLimitResult,
  TestDataInput,
} from "@/lib/actions/admin-email-templates";
import { setEmailsEnabled as saveEmailsEnabledGlobally } from "@/lib/actions/global-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sun, Moon, Monitor, Smartphone, Loader2 } from "lucide-react";
import { markdownToHtml } from "@/lib/markdown";
import type { SendAfterOption } from "@/lib/actions/global-settings";
import {
  substituteEmailTemplatePlaceholders,
  placeholderValuesFromTestDataInput,
} from "@/lib/email-placeholders";

/** When to trigger the email. Delayed sending requires a worker/cron to be implemented. */
const SEND_AFTER_OPTIONS: { value: SendAfterOption; label: string }[] = [
  { value: "instant", label: "Instant" },
  { value: "5m", label: "5 minutes" },
  { value: "15m", label: "15 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "2h", label: "2 hours" },
  { value: "1d", label: "1 day" },
  { value: "2d", label: "2 days" },
  { value: "3d", label: "3 days" },
  { value: "5d", label: "5 days" },
  { value: "7d", label: "7 days" },
  { value: "10d", label: "10 days" },
  { value: "14d", label: "14 days" },
  { value: "21d", label: "21 days" },
  { value: "30d", label: "30 days" },
  { value: "60d", label: "60 days" },
  { value: "on_dob", label: "On DOB" },
];

function getSendAfterLabel(value: string): string {
  return SEND_AFTER_OPTIONS.find((o) => o.value === value)?.label ?? (value || "Instant");
}

const APP_URL = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bondback.io") : "https://www.bondback.io";
const UNSUBSCRIBE_FOOTER_HTML = `
<div style="margin-top:2em;padding-top:1em;border-top:1px solid #eee;font-size:12px;color:#666;">
  <p>You received this email because of your Bond Back notification settings.</p>
  <p><a href="${APP_URL}/profile?tab=notifications">Manage notification preferences or unsubscribe</a></p>
</div>`;

function replacePlaceholdersClient(text: string, data: TestDataInput): string {
  return substituteEmailTemplatePlaceholders(
    text,
    placeholderValuesFromTestDataInput(data)
  );
}

function makeLinksOpenInNewTab(html: string): string {
  return html.replace(/<a\s+([^>]*?)href=/gi, '<a $1target="_blank" rel="noopener noreferrer" href=');
}

/** Wrap body HTML in a Gmail-like email chrome (From, To, Subject, Date, then body). */
function wrapEmailPreview(subject: string, bodyHtml: string, dark: boolean): string {
  const bg = dark ? "#1f2937" : "#f9fafb";
  const cardBg = dark ? "#111827" : "#ffffff";
  const border = dark ? "#374151" : "#e5e7eb";
  const text = dark ? "#f3f4f6" : "#111827";
  const muted = dark ? "#9ca3af" : "#6b7280";
  const now = new Date();
  const dateStr = now.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: ${bg}; margin: 0; padding: 16px; min-height: 100%; color: ${text};">
  <div style="max-width: 640px; margin: 0 auto; background: ${cardBg}; border: 1px solid ${border}; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden;">
    <div style="padding: 12px 16px; border-bottom: 1px solid ${border}; font-size: 13px;">
      <div style="display: flex; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 6px;">
        <span style="color: ${muted}; min-width: 52px;">From:</span>
        <span>Bond Back &lt;noreply@bondback.io&gt;</span>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 6px;">
        <span style="color: ${muted}; min-width: 52px;">To:</span>
        <span>recipient@example.com</span>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 6px;">
        <span style="color: ${muted}; min-width: 52px;">Subject:</span>
        <span style="font-weight: 600;">${subject.replace(/</g, "&lt;")}</span>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px 16px;">
        <span style="color: ${muted}; min-width: 52px;">Date:</span>
        <span>${dateStr}</span>
      </div>
    </div>
    <div class="email-preview-body" style="padding: 20px 16px; font-size: 14px; line-height: 1.6; color: ${text};">
      ${bodyHtml}
    </div>
  </div>
  <style>.email-preview-body,.email-preview-body *{color:inherit !important;}</style>
</div>`;
}

/** Normalize template active flag (DB may return boolean or string). */
function isTemplateActive(t: { active?: unknown } | null | undefined): boolean {
  if (t == null || t.active == null) return false;
  const a = t.active;
  if (typeof a === "boolean") return a;
  if (typeof a === "string") return a.toLowerCase().trim() === "true" || a === "1";
  return false;
}

export type AdminEmailTemplatesProps = {
  initial: EmailTemplatesData | null;
};

export function AdminEmailTemplates({ initial }: AdminEmailTemplatesProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [emailsEnabled, setEmailsEnabled] = React.useState(
    initial?.emailsEnabled ?? true
  );
  const [typeEnabled, setTypeEnabled] = React.useState<
    Record<string, boolean>
  >(initial?.typeEnabled ?? {});
  const [templates, setTemplates] = React.useState(
    initial?.templates ?? {}
  );

  // Sync when initial changes (e.g. after refresh)
  React.useEffect(() => {
    if (initial) {
      setEmailsEnabled(initial.emailsEnabled);
      setTypeEnabled(initial.typeEnabled);
      setTemplates(initial.templates);
    }
  }, [initial]);

  const [editType, setEditType] = React.useState<string | null>(null);
  const [editSubject, setEditSubject] = React.useState("");
  const [editBody, setEditBody] = React.useState("");
  const [editActive, setEditActive] = React.useState(true);
  const [editSendAfter, setEditSendAfter] = React.useState<string>("instant");
  const [previewDarkMode, setPreviewDarkMode] = React.useState(false);
  const [deviceView, setDeviceView] = React.useState<"desktop" | "mobile">("desktop");
  const [testName, setTestName] = React.useState("Alex");
  const [testRole, setTestRole] = React.useState<"Lister" | "Cleaner">("Lister");
  const [testJobId, setTestJobId] = React.useState("10042");
  const [testAmount, setTestAmount] = React.useState("$280");
  const [testListingTitle, setTestListingTitle] = React.useState("3br House Bond Clean – Sydney");
  const [testSuburb, setTestSuburb] = React.useState("Sydney");
  const [testMessage, setTestMessage] = React.useState("Hi, would Tuesday 2pm work for the clean?");
  const [testSenderName, setTestSenderName] = React.useState("Alex Smith");
  const [sendTestToEmail, setSendTestToEmail] = React.useState("");
  const [isSendingTestFromEdit, setIsSendingTestFromEdit] = React.useState(false);
  const previewIframeRef = React.useRef<HTMLIFrameElement>(null);

  const [createKey, setCreateKey] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [previewModalOpen, setPreviewModalOpen] = React.useState(false);
  const [previewModalType, setPreviewModalType] = React.useState<string | null>(null);
  const [previewModalSubject, setPreviewModalSubject] = React.useState("");
  const [previewModalBody, setPreviewModalBody] = React.useState("");
  const previewModalIframeRef = React.useRef<HTMLIFrameElement>(null);
  const [sendTestOpen, setSendTestOpen] = React.useState(false);
  const [sendTestType, setSendTestType] = React.useState<string | null>(null);
  const [sendTestEmailInput, setSendTestEmailInput] = React.useState("");
  const [rateLimit, setRateLimit] = React.useState<TestSendRateLimitResult | null>(null);

  const allTemplateKeys = React.useMemo(() => {
    const custom = Object.keys(templates).filter((k) => !EMAIL_TEMPLATE_TYPES.includes(k as never));
    return [...EMAIL_TEMPLATE_TYPES, ...custom.sort()];
  }, [templates]);

  const testData: TestDataInput = React.useMemo(
    () => ({
      messageText: testMessage,
      jobId: testJobId,
      senderName: testSenderName,
      listingId: testJobId,
      name: testName,
      role: testRole,
      amount: testAmount,
      listingTitle: testListingTitle,
      suburb: testSuburb,
    }),
    [testMessage, testJobId, testSenderName, testName, testRole, testAmount, testListingTitle, testSuburb]
  );

  const livePreview = React.useMemo(() => {
    const subj = replacePlaceholdersClient(editSubject || "(No subject)", testData);
    const rawBody =
      editBody?.trim() ||
      "<p><em>No template body yet — add subject and body to see preview.</em></p>";
    const bodyHtml = markdownToHtml(rawBody);
    const bodyWithPlaceholders = replacePlaceholdersClient(bodyHtml, testData);
    const fullHtml = bodyWithPlaceholders + UNSUBSCRIBE_FOOTER_HTML;
    const htmlWithLinks = makeLinksOpenInNewTab(fullHtml);
    return { subject: subj, html: htmlWithLinks };
  }, [editSubject, editBody, testData]);

  // Sync edit dialog iframe when preview or theme changes (Gmail-like wrapper). Defer so iframe is mounted.
  React.useEffect(() => {
    const subject = livePreview.subject;
    const html = livePreview.html;
    const dark = previewDarkMode;
    const writeIframe = () => {
      const iframe = previewIframeRef.current;
      if (!iframe?.contentDocument) return;
      const doc = iframe.contentDocument;
      doc.open();
      doc.write(
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body></body></html>"
      );
      doc.close();
      const body = doc.body;
      body.style.margin = "0";
      body.style.minHeight = "100%";
      body.innerHTML = wrapEmailPreview(subject, html, dark);
      body.querySelectorAll("a[href]").forEach((a) => {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      });
    };
    const id = setTimeout(writeIframe, 0);
    return () => clearTimeout(id);
  }, [livePreview.html, livePreview.subject, previewDarkMode]);

  const previewModalLivePreview = React.useMemo(() => {
    const subj = replacePlaceholdersClient(previewModalSubject || "(No subject)", testData);
    const rawBody = previewModalBody?.trim() || "<p><em>No body.</em></p>";
    const bodyHtml = markdownToHtml(rawBody);
    const bodyWithPlaceholders = replacePlaceholdersClient(bodyHtml, testData);
    const fullHtml = bodyWithPlaceholders + UNSUBSCRIBE_FOOTER_HTML;
    return { subject: subj, html: makeLinksOpenInNewTab(fullHtml) };
  }, [previewModalSubject, previewModalBody, testData]);

  React.useEffect(() => {
    if (!previewModalOpen) return;
    const subject = previewModalLivePreview.subject;
    const html = previewModalLivePreview.html;
    const dark = previewDarkMode;
    const writeIframe = () => {
      const iframe = previewModalIframeRef.current;
      if (!iframe?.contentDocument) return;
      const doc = iframe.contentDocument;
      doc.open();
      doc.write(
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body></body></html>"
      );
      doc.close();
      const body = doc.body;
      body.style.margin = "0";
      body.style.minHeight = "100%";
      body.innerHTML = wrapEmailPreview(subject, html, dark);
      body.querySelectorAll("a[href]").forEach((a) => {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      });
    };
    const id = setTimeout(writeIframe, 0);
    return () => clearTimeout(id);
  }, [previewModalOpen, previewModalLivePreview.html, previewModalLivePreview.subject, previewDarkMode]);

  React.useEffect(() => {
    if (sendTestOpen || previewModalOpen) return;
    getTestSendRateLimit().then(setRateLimit);
  }, [sendTestOpen, previewModalOpen]);

  const openEdit = (type: string) => {
    const t = templates[type];
    const def = getDefaultTemplate(type);
    setEditType(type);
    setEditSubject(t?.subject?.trim() ? t.subject : (def?.subject ?? ""));
    setEditBody(t?.body?.trim() ? t.body : (def?.body ?? ""));
    setEditActive(isTemplateActive(t));
    setEditSendAfter(type === "birthday" ? "on_dob" : (t?.send_after ?? "instant"));
  };

  const handleSaveTemplate = () => {
    if (!editType) return;
    const sendAfter = editType === "birthday" ? "on_dob" : editSendAfter;
    startTransition(async () => {
      const result = await saveEmailTemplate(
        editType,
        editSubject,
        editBody,
        editActive,
        sendAfter
      );
      if (result.ok) {
        toast({ title: "Template saved", description: `${getEmailTypeLabel(editType)} updated.` });
        setEditType(null);
        setTemplates((prev) => ({
          ...prev,
          [editType]: { subject: editSubject, body: editBody, active: editActive, send_after: editType === "birthday" ? "on_dob" : editSendAfter },
        }));
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    });
  };

  const handleToggleAll = (enabled: boolean) => {
    startTransition(async () => {
      const result = await saveEmailsEnabledGlobally(enabled);
      if (result.ok) {
        setEmailsEnabled(enabled);
        toast({ title: enabled ? "All emails enabled" : "All emails disabled" });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    });
  };

  const handleToggleType = (type: string, enabled: boolean) => {
    startTransition(async () => {
      const result = await toggleEmailType(type, enabled);
      if (result.ok) {
        setTypeEnabled((prev) => ({ ...prev, [type]: enabled }));
        toast({ title: enabled ? "Emails enabled" : "Emails disabled", description: getEmailTypeLabel(type) });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    });
  };

  const handleCreateTemplate = () => {
    startTransition(async () => {
      const result = await createEmailTemplate(createKey);
      if (result.ok) {
        toast({ title: "Template created", description: `"${result.type}" added. You can edit it below.` });
        setCreateKey("");
        setCreateOpen(false);
        setTemplates((prev) => ({ ...prev, [result.type]: { subject: "", body: "", active: false, send_after: "instant" } }));
        setEditType(result.type);
        setEditSubject("");
        setEditBody("");
        setEditActive(false);
        setEditSendAfter("instant");
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    });
  };

  const openPreviewModal = (type: string, subject: string, body: string) => {
    const def = getDefaultTemplate(type);
    setPreviewModalType(type);
    setPreviewModalSubject(subject?.trim() ? subject : (def?.subject ?? ""));
    setPreviewModalBody(body?.trim() ? body : (def?.body ?? ""));
    setPreviewModalOpen(true);
  };

  const handleToggleActive = (type: string, nextActive: boolean) => {
    const t = templates[type];
    const def = getDefaultTemplate(type);
    const subject = (t?.subject?.trim() || def?.subject) ?? "";
    const body = (t?.body?.trim() || def?.body) ?? "";
    const sendAfter = type === "birthday" ? "on_dob" : (t?.send_after ?? "instant");
    startTransition(() => {
      saveEmailTemplate(type, subject, body, nextActive, sendAfter).then((result) => {
        if (result.ok) {
          setTemplates((prev) => ({ ...prev, [type]: { subject, body, active: nextActive, send_after: sendAfter } }));
          toast({ title: nextActive ? "Template enabled" : "Template disabled" });
          router.refresh();
        } else {
          toast({ variant: "destructive", title: "Error", description: result.error });
        }
      });
    });
  };

  const openSendTest = (type: string) => {
    setSendTestType(type);
    setSendTestEmailInput("");
    setSendTestOpen(true);
    getTestSendRateLimit().then(setRateLimit);
  };

  const [isSendingTest, setIsSendingTest] = React.useState(false);
  const handleSendTest = async () => {
    if (!sendTestType) return;
    const toEmail = sendTestEmailInput?.trim() || null;
    const t = templates[sendTestType];
    const def = getDefaultTemplate(sendTestType);
    const subject = (t?.subject?.trim() || def?.subject) ?? "(No subject)";
    const body = (t?.body?.trim() || def?.body) ?? "";
    const sample = getSampleDataForType(sendTestType);
    const testData: TestDataInput = {
      messageText: sample.messageText,
      jobId: sample.jobId != null ? String(sample.jobId) : "10042",
      senderName: sample.senderName,
      listingId: sample.listingId != null ? String(sample.listingId) : "10042",
      name: "Alex",
      role: "Lister",
      amount: "$280",
      listingTitle: "3br House Bond Clean – Sydney",
      suburb: "Sydney",
      listerName: "Jamie Chen",
      cleanerName: "Chris Taylor",
    };
    setIsSendingTest(true);
    const result = await sendTestEmailWithContent(sendTestType, toEmail, subject, body, testData);
    setIsSendingTest(false);
    if (result.ok) {
      toast({ title: "Test email sent", description: toEmail ? `Sent to ${toEmail}` : "Check your inbox." });
      setSendTestOpen(false);
      setSendTestType(null);
      setSendTestEmailInput("");
      getTestSendRateLimit().then(setRateLimit);
    } else {
      toast({ variant: "destructive", title: "Send failed", description: result.error });
    }
  };

  const handleSendTestWithContent = () => {
    if (!editType) return;
    setIsSendingTestFromEdit(true);
    sendTestEmailWithContent(
      editType,
      sendTestToEmail || null,
      editSubject,
      editBody,
      testData
    ).then((result) => {
      setIsSendingTestFromEdit(false);
      if (result.ok) {
        toast({ title: "Test email sent", description: "Check the recipient inbox." });
        getTestSendRateLimit().then(setRateLimit);
      } else {
        toast({ variant: "destructive", title: "Send failed", description: result.error });
      }
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
        <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between sm:pb-4">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight sm:text-lg md:text-xl dark:text-gray-100">
              Global email toggles
            </CardTitle>
            <p className="text-xs leading-relaxed text-muted-foreground dark:text-gray-400">
              Kill switch and per-type enable/disable. When off, no emails are sent for that type.
            </p>
          </div>
          <Badge variant="outline" className="w-fit shrink-0 text-[10px] uppercase tracking-wide">
            Admin only
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 dark:border-gray-800">
            <div className="min-w-0 flex-1">
              <Label className="text-sm font-medium">Enable all emails</Label>
              <p className="text-xs text-muted-foreground">Master switch; when off, no notification emails are sent.</p>
            </div>
            <Switch
              checked={emailsEnabled}
              onCheckedChange={handleToggleAll}
              disabled={isPending}
              className="shrink-0 self-end sm:self-center"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {allTemplateKeys.map((type) => (
              <div
                key={type}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 dark:border-gray-800"
              >
                <Label className="min-w-0 flex-1 text-sm leading-snug break-words">{getEmailTypeLabel(type)}</Label>
                <Switch
                  checked={typeEnabled[type] !== false}
                  onCheckedChange={(enabled) => handleToggleType(type, enabled)}
                  disabled={isPending || !emailsEnabled}
                  className="shrink-0"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
        <CardHeader className="space-y-1 pb-3 sm:pb-4">
          <CardTitle className="text-base font-semibold tracking-tight sm:text-lg md:text-xl dark:text-gray-100">
            Template management
          </CardTitle>
          <p className="text-xs leading-relaxed text-muted-foreground dark:text-gray-400">
            Override subject and body per type; leave empty to use defaults. Preview, edit, or send a test from each row.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={isPending}
              onClick={async () => {
                startTransition(async () => {
                  const result = await applyDefaultEmailTemplates();
                  if (result.ok) {
                    toast({ title: "Templates pre-filled", description: result.count ? `${result.count} template(s) filled with default content.` : "All templates already had content." });
                    router.refresh();
                  } else {
                    toast({ variant: "destructive", title: "Error", description: result.error });
                  }
                });
              }}
            >
              Pre-fill all
            </Button>
            <Button
              variant="default"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => { setCreateKey(""); setCreateOpen(true); }}
              disabled={isPending}
            >
              Create template
            </Button>
          </div>

          {/* Mobile: one card per template */}
          <div className="space-y-3 md:hidden">
            {allTemplateKeys.map((type) => {
              const t = templates[type];
              const isBirthday = type === "birthday";
              const sendAfter = isBirthday ? "on_dob" : (t?.send_after ?? "instant");
              return (
                <div
                  key={`m-${type}`}
                  className="rounded-xl border border-border bg-muted/20 p-3 dark:border-gray-800 dark:bg-gray-900/50"
                >
                  <p className="font-medium leading-snug text-foreground dark:text-gray-100">{getEmailTypeLabel(type)}</p>
                  <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground dark:text-gray-400">
                    {t?.subject?.trim() ? t.subject : "— default subject —"}
                  </p>
                  <div className="mt-3 space-y-2 border-t border-border pt-3 dark:border-gray-800">
                    <span className="block text-[10px] font-medium uppercase text-muted-foreground">Send after</span>
                    {isBirthday ? (
                      <span
                        className="inline-flex min-h-9 w-full items-center justify-center rounded-md border border-border bg-muted/50 px-2 text-xs text-muted-foreground dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        title="Birthday emails always send on the user's date of birth."
                      >
                        On DOB (locked)
                      </span>
                    ) : (
                      <Select
                        value={sendAfter}
                        onValueChange={(value) => {
                          const def = getDefaultTemplate(type);
                          const subject = (t?.subject?.trim() || def?.subject) ?? "";
                          const body = (t?.body?.trim() || def?.body) ?? "";
                          startTransition(() => {
                            saveEmailTemplate(type, subject, body, isTemplateActive(t), value).then((result) => {
                              if (result.ok) {
                                setTemplates((prev) => ({
                                  ...prev,
                                  [type]: {
                                    subject: t?.subject ?? "",
                                    body: t?.body ?? "",
                                    active: isTemplateActive(t),
                                    send_after: value,
                                  },
                                }));
                                toast({ title: "Send timing updated", description: getSendAfterLabel(value) });
                                router.refresh();
                              } else {
                                toast({ variant: "destructive", title: "Error", description: result.error });
                              }
                            });
                          });
                        }}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-9 w-full text-xs bg-background dark:bg-gray-800 dark:border-gray-700">
                          <SelectValue placeholder="When" />
                        </SelectTrigger>
                        <SelectContent className="bg-background dark:bg-gray-900 dark:border-gray-700">
                          {SEND_AFTER_OPTIONS.filter((o) => o.value !== "on_dob").map((o) => (
                            <SelectItem key={o.value} value={o.value} className="dark:focus:bg-gray-700 dark:text-gray-100">
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium uppercase text-muted-foreground">Active</span>
                    <Switch
                      checked={isTemplateActive(t)}
                      onCheckedChange={(checked) => handleToggleActive(type, !!checked)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => openPreviewModal(type, t?.subject ?? "", t?.body ?? "")}
                      disabled={isPending}
                    >
                      Preview
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => openEdit(type)}
                      disabled={isPending}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => openSendTest(type)}
                      disabled={isPending || (rateLimit !== null && !rateLimit.allowed)}
                    >
                      Test
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tablet/desktop: table with horizontal scroll fallback */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-border -mx-1 px-1 dark:border-gray-800 sm:mx-0 sm:px-0">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="border-border dark:border-gray-800">
                  <TableHead className="text-muted-foreground w-[140px]">Type</TableHead>
                  <TableHead className="text-muted-foreground min-w-[180px]">Subject</TableHead>
                  <TableHead className="text-muted-foreground w-[120px]">Send after</TableHead>
                  <TableHead className="text-muted-foreground w-20">Active</TableHead>
                  <TableHead className="text-right min-w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTemplateKeys.map((type) => {
                  const t = templates[type];
                  const isBirthday = type === "birthday";
                  const sendAfter = isBirthday ? "on_dob" : (t?.send_after ?? "instant");
                  return (
                    <TableRow key={type} className="border-border dark:border-gray-800">
                      <TableCell className="font-medium align-top">{getEmailTypeLabel(type)}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground align-top">
                        {t?.subject || "—"}
                      </TableCell>
                      <TableCell className="align-top">
                        {isBirthday ? (
                          <span className="inline-flex h-8 items-center rounded-md border border-border bg-muted/50 px-2.5 text-xs text-muted-foreground dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400" title="Birthday emails always send on the user's date of birth.">
                            On DOB (locked)
                          </span>
                        ) : (
                          <Select
                            value={sendAfter}
                            onValueChange={(value) => {
                              const def = getDefaultTemplate(type);
                              const subject = (t?.subject?.trim() || def?.subject) ?? "";
                              const body = (t?.body?.trim() || def?.body) ?? "";
                              startTransition(() => {
                                saveEmailTemplate(type, subject, body, isTemplateActive(t), value).then((result) => {
                                  if (result.ok) {
                                    setTemplates((prev) => ({ ...prev, [type]: { subject: t?.subject ?? "", body: t?.body ?? "", active: isTemplateActive(t), send_after: value } }));
                                    toast({ title: "Send timing updated", description: getSendAfterLabel(value) });
                                    router.refresh();
                                  } else {
                                    toast({ variant: "destructive", title: "Error", description: result.error });
                                  }
                                });
                              });
                            }}
                            disabled={isPending}
                          >
                            <SelectTrigger className="h-8 text-xs w-[110px] bg-background dark:bg-gray-800 dark:border-gray-700">
                              <SelectValue placeholder="When" />
                            </SelectTrigger>
                            <SelectContent className="bg-background dark:bg-gray-900 dark:border-gray-700">
                              {SEND_AFTER_OPTIONS.filter((o) => o.value !== "on_dob").map((o) => (
                                <SelectItem key={o.value} value={o.value} className="dark:focus:bg-gray-700 dark:text-gray-100">
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Switch
                          checked={isTemplateActive(t)}
                          onCheckedChange={(checked) => handleToggleActive(type, !!checked)}
                          disabled={isPending}
                        />
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => openPreviewModal(type, t?.subject ?? "", t?.body ?? "")}
                            disabled={isPending}
                          >
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => openEdit(type)}
                            disabled={isPending}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => openSendTest(type)}
                            disabled={isPending || (rateLimit !== null && !rateLimit.allowed)}
                          >
                            Send test
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {rateLimit !== null && (
            <p className="text-xs text-muted-foreground">
              Test sends: {rateLimit.remaining} of {rateLimit.limit} remaining this hour.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editType} onOpenChange={(open) => !open && setEditType(null)}>
        <DialogContent className="left-2 top-4 max-h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] max-w-[min(100vw-1rem,72rem)] translate-x-0 translate-y-0 overflow-y-auto p-4 sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:w-full sm:max-w-6xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:p-6">
          <DialogHeader>
            <DialogTitle>
              Edit template: {editType ? getEmailTypeLabel(editType) : ""}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Split view: editor on the left, live preview on the right. Placeholders: {"{{message}}"}, {"{{jobId}}"}, {"{{senderName}}"}, {"{{listingId}}"}, [Name], [Role], [JobId], [Amount], {"{name}"}, {"{listingTitle}"}.
            </p>
          </DialogHeader>
          <div className="grid gap-6 py-2 sm:py-4 lg:grid-cols-2">
            {/* Left: Editor */}
            <div className="min-w-0 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Editor</p>
              <div className="grid gap-2">
                <Label htmlFor="edit-subject">Subject</Label>
                <Input
                  id="edit-subject"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="Email subject line"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-body">Body (Markdown or HTML)</Label>
                <Textarea
                  id="edit-body"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="Placeholders: {name}, {role}, {jobId}, {amount}, {listingTitle}, {suburb}, {{message}}, {{senderName}}"
                  className="min-h-[400px] font-mono text-sm resize-y"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3 dark:border-gray-800">
                <Label>Use this template when sending</Label>
                <Switch checked={editActive} onCheckedChange={setEditActive} />
              </div>

              <div className="rounded-lg border border-border p-3 dark:border-gray-800 space-y-2">
                <Label className="text-sm font-medium">Send after</Label>
                {editType === "birthday" ? (
                  <>
                    <p className="text-xs text-muted-foreground">Birthday emails always send on the user&apos;s date of birth. This cannot be changed.</p>
                    <div className="inline-flex h-9 items-center rounded-md border border-border bg-muted/50 px-3 text-sm text-muted-foreground dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                      On DOB (locked)
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">When to trigger this email. Delayed options require a worker/cron to be set up.</p>
                    <Select value={editSendAfter} onValueChange={setEditSendAfter}>
                      <SelectTrigger className="w-full max-w-xs bg-background dark:bg-gray-800 dark:border-gray-700">
                        <SelectValue placeholder="When to send" />
                      </SelectTrigger>
                      <SelectContent className="bg-background dark:bg-gray-900 dark:border-gray-700">
                        {SEND_AFTER_OPTIONS.filter((o) => o.value !== "on_dob").map((o) => (
                          <SelectItem key={o.value} value={o.value} className="dark:focus:bg-gray-700 dark:text-gray-100">
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>

              <Card className="border-border dark:border-gray-800">
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold">Personalization tester</CardTitle>
                      <p className="text-xs text-muted-foreground">Values used to replace placeholders in the preview.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={async () => {
                        const res = await getTestUserProfileForPreview();
                        if (res.ok) {
                          setTestName(res.data.name ?? "Alex");
                          setTestRole((res.data.role === "Cleaner" ? "Cleaner" : "Lister") as "Lister" | "Cleaner");
                          setTestSenderName(res.data.senderName ?? res.data.name ?? "");
                          setTestMessage(res.data.messageText ?? testMessage);
                          setTestJobId(res.data.jobId ?? "10042");
                          setTestAmount(res.data.amount ?? "$280");
                          setTestListingTitle(res.data.listingTitle ?? testListingTitle);
                          setTestSuburb(res.data.suburb ?? testSuburb);
                          toast({ title: "Loaded your profile", description: "Preview uses your name and role." });
                        } else {
                          toast({ variant: "destructive", title: "Could not load profile", description: res.error });
                        }
                      }}
                    >
                      Use my profile
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Test Name</Label>
                      <Input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Alex" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Test Role</Label>
                      <Select value={testRole} onValueChange={(v) => setTestRole(v as "Lister" | "Cleaner")}>
                        <SelectTrigger className="h-8 text-xs bg-background text-foreground border-input dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent className="bg-background dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100">
                          <SelectItem value="Lister" className="dark:focus:bg-gray-700 dark:text-gray-100">Lister</SelectItem>
                          <SelectItem value="Cleaner" className="dark:focus:bg-gray-700 dark:text-gray-100">Cleaner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Test Job ID</Label>
                      <Input value={testJobId} onChange={(e) => setTestJobId(e.target.value)} placeholder="10042" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Test Amount</Label>
                      <Input value={testAmount} onChange={(e) => setTestAmount(e.target.value)} placeholder="$280" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Listing Title</Label>
                      <Input value={testListingTitle} onChange={(e) => setTestListingTitle(e.target.value)} placeholder="3br House Bond Clean – Sydney" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Test Suburb</Label>
                      <Input value={testSuburb} onChange={(e) => setTestSuburb(e.target.value)} placeholder="Sydney" className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Message ({"{{message}}"})</Label>
                    <Input value={testMessage} onChange={(e) => setTestMessage(e.target.value)} placeholder="Sample message" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sender ({"{{senderName}}"})</Label>
                    <Input value={testSenderName} onChange={(e) => setTestSenderName(e.target.value)} placeholder="Alex Smith" className="h-8 text-xs" />
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-lg border border-border p-3 dark:border-gray-800">
                <Label className="mb-2 block text-xs font-medium">Send test email</Label>
                <p className="text-[11px] text-muted-foreground mb-2">Sends current subject and body with personalization data via Resend.</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    type="email"
                    value={sendTestToEmail}
                    onChange={(e) => setSendTestToEmail(e.target.value)}
                    placeholder="Email (blank = your account)"
                    className="h-9 flex-1 min-w-0 text-sm"
                  />
                  <Button
                    size="sm"
                    className="h-9 shrink-0 sm:w-auto w-full"
                    onClick={handleSendTestWithContent}
                    disabled={isSendingTestFromEdit || isPending}
                  >
                    {isSendingTestFromEdit ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Send test"
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-row flex-wrap items-center justify-end gap-2 pt-2 border-t border-border dark:border-gray-800">
                <Button variant="outline" size="sm" onClick={() => setEditType(null)} disabled={isPending}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveTemplate} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </div>

            {/* Right: Live preview */}
            <div className="min-w-0 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Live preview</p>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Tabs value={previewDarkMode ? "dark" : "light"} onValueChange={(v) => setPreviewDarkMode(v === "dark")}>
                  <TabsList className="h-8 p-0.5">
                    <TabsTrigger className="h-7 gap-1 px-2 text-xs" value="light">
                      <Sun className="h-3 w-3" />
                      Light
                    </TabsTrigger>
                    <TabsTrigger className="h-7 gap-1 px-2 text-xs" value="dark">
                      <Moon className="h-3 w-3" />
                      Dark
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Tabs value={deviceView} onValueChange={(v) => setDeviceView(v as "desktop" | "mobile")}>
                  <TabsList className="h-8 p-0.5">
                    <TabsTrigger className="h-7 gap-1 px-2 text-xs" value="desktop">
                      <Monitor className="h-3 w-3" />
                      Desktop
                    </TabsTrigger>
                    <TabsTrigger className="h-7 gap-1 px-2 text-xs" value="mobile">
                      <Smartphone className="h-3 w-3" />
                      Mobile
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div
                className={`rounded border border-border dark:border-gray-800 overflow-hidden bg-muted/30 ${
                  deviceView === "mobile" ? "max-w-[375px] mx-auto" : "w-full"
                }`}
              >
                <div className="border-b border-border bg-muted/50 px-2 py-1.5 text-xs font-medium text-muted-foreground dark:border-gray-800">
                  Subject: {livePreview.subject}
                </div>
                <div className="relative bg-muted/20" style={{ height: 440 }}>
                  <iframe
                    ref={previewIframeRef}
                    title="Email preview"
                    className="w-full h-full border-0"
                    style={{
                      width: deviceView === "mobile" ? 375 : "100%",
                      maxWidth: "100%",
                    }}
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Use a key like <code className="rounded bg-muted px-1">new_bid</code> or <code className="rounded bg-muted px-1">custom_promo</code>. Letters, numbers and underscore only.
          </p>
          <div className="grid gap-2 py-2">
            <Label htmlFor="create-key">Template key</Label>
            <Input
              id="create-key"
              value={createKey}
              onChange={(e) => setCreateKey(e.target.value)}
              placeholder="e.g. custom_promo"
              className="font-mono"
            />
          </div>
          <div className="flex flex-row justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateTemplate} disabled={isPending || !createKey.trim()}>
              {isPending ? "Creating…" : "Create template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interactive Preview modal: live editing + personalization + iframe + theme/device */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="left-2 top-4 max-h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] max-w-[min(100vw-1rem,64rem)] translate-x-0 translate-y-0 overflow-y-auto p-4 sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:w-full sm:max-w-5xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:p-6">
          <DialogHeader>
            <DialogTitle>
              Preview: {previewModalType ? getEmailTypeLabel(previewModalType) : ""}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Edit subject and body below; preview updates instantly. Use personalization to replace placeholders. Toggle device and theme for accurate rendering.
            </p>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="min-w-0 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Subject (live)</Label>
                <Input
                  value={previewModalSubject}
                  onChange={(e) => setPreviewModalSubject(e.target.value)}
                  placeholder="Email subject"
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Body (live)</Label>
                <Textarea
                  value={previewModalBody}
                  onChange={(e) => setPreviewModalBody(e.target.value)}
                  placeholder="Markdown or HTML body"
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                <Label className="text-sm font-medium">Personalization</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={async () => {
                    const res = await getTestUserProfileForPreview();
                    if (res.ok) {
                      setTestName(res.data.name ?? "Alex");
                      setTestRole((res.data.role === "Cleaner" ? "Cleaner" : "Lister") as "Lister" | "Cleaner");
                      setTestSenderName(res.data.senderName ?? res.data.name ?? "");
                      setTestMessage(res.data.messageText ?? testMessage);
                      setTestJobId(res.data.jobId ?? "10042");
                      setTestAmount(res.data.amount ?? "$280");
                      setTestListingTitle(res.data.listingTitle ?? testListingTitle);
                      setTestSuburb(res.data.suburb ?? testSuburb);
                      toast({ title: "Loaded your profile", description: "Preview uses your name and role." });
                    } else {
                      toast({ variant: "destructive", title: "Could not load profile", description: res.error });
                    }
                  }}
                >
                  Use my profile
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={testName} onChange={(e) => setTestName(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Role</Label>
                  <Select value={testRole} onValueChange={(v) => setTestRole(v as "Lister" | "Cleaner")}>
                    <SelectTrigger className="h-8 text-xs bg-background text-foreground border-input dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent className="bg-background dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100">
                      <SelectItem value="Lister" className="dark:focus:bg-gray-700 dark:text-gray-100">Lister</SelectItem>
                      <SelectItem value="Cleaner" className="dark:focus:bg-gray-700 dark:text-gray-100">Cleaner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Job ID</Label>
                  <Input value={testJobId} onChange={(e) => setTestJobId(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Amount</Label>
                  <Input value={testAmount} onChange={(e) => setTestAmount(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Listing Title</Label>
                  <Input value={testListingTitle} onChange={(e) => setTestListingTitle(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Suburb</Label>
                  <Input value={testSuburb} onChange={(e) => setTestSuburb(e.target.value)} placeholder="Sydney" className="h-8 text-xs" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Message</Label>
                  <Input value={testMessage} onChange={(e) => setTestMessage(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Sender</Label>
                  <Input value={testSenderName} onChange={(e) => setTestSenderName(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-row flex-wrap items-center gap-3">
                <Tabs value={previewDarkMode ? "dark" : "light"} onValueChange={(v) => setPreviewDarkMode(v === "dark")}>
                  <TabsList className="h-8 p-0.5">
                    <TabsTrigger className="h-7 gap-1 px-2 text-xs" value="light"><Sun className="h-3 w-3" /> Light</TabsTrigger>
                    <TabsTrigger className="h-7 gap-1 px-2 text-xs" value="dark"><Moon className="h-3 w-3" /> Dark</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Tabs value={deviceView} onValueChange={(v) => setDeviceView(v as "desktop" | "mobile")}>
                  <TabsList className="h-8 p-0.5">
                    <TabsTrigger className="h-7 gap-1 px-2 text-xs" value="desktop"><Monitor className="h-3 w-3" /> Desktop</TabsTrigger>
                    <TabsTrigger className="h-7 gap-1 px-2 text-xs" value="mobile"><Smartphone className="h-3 w-3" /> Mobile</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className={`rounded border border-border dark:border-gray-800 overflow-hidden ${deviceView === "mobile" ? "max-w-[375px]" : ""}`}>
                <div className="border-b border-border bg-muted/50 px-2 py-1.5 text-xs font-medium text-muted-foreground dark:border-gray-800">
                  Subject: {previewModalLivePreview.subject}
                </div>
                <div className="bg-muted/20" style={{ height: 320 }}>
                  <iframe
                    ref={previewModalIframeRef}
                    title="Preview"
                    className="w-full h-full border-0"
                    style={{ width: deviceView === "mobile" ? 375 : "100%", maxWidth: "100%" }}
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sendTestOpen} onOpenChange={(open) => !open && setSendTestOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send test email</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {sendTestType && getEmailTypeLabel(sendTestType)} — sends this template’s subject and body with sample data. You can send to any email address.
          </p>
          {rateLimit !== null && (
            <p className="text-xs text-muted-foreground">
              {rateLimit.remaining} of {rateLimit.limit} test sends remaining this hour.
            </p>
          )}
          <div className="grid gap-2 py-2">
            <Label htmlFor="test-email">Send to</Label>
            <Input
              id="test-email"
              type="email"
              value={sendTestEmailInput}
              onChange={(e) => setSendTestEmailInput(e.target.value)}
              placeholder="Email (blank = your account email)"
            />
          </div>
          <div className="flex flex-row justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setSendTestOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSendTest}
              disabled={isSendingTest || (rateLimit !== null && !rateLimit.allowed)}
            >
              {isSendingTest ? "Sending…" : "Send test"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
