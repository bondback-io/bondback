import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <section className="page-inner space-y-6">
      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight dark:text-gray-100">
            Privacy Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground dark:text-gray-300">
          <p>
            This is a placeholder privacy policy. Add your full policy text here before going
            live.
          </p>
          <p>
            Bond Back stores necessary account and job information to operate the
            marketplace. You can request a copy of your data or account deletion from the
            Settings page or by emailing support@bondback.com.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

