import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <section className="page-inner space-y-6">
      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight dark:text-gray-100">
            Terms of Service
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground dark:text-gray-300">
          <p>
            These terms are a placeholder for your legal Terms of Service. Add your full
            agreement text here before going live.
          </p>
          <p>
            By using Bond Back, you agree to follow local laws and treat other users fairly.
            Disputes are handled via the in-app dispute flow and may be escalated to admin.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

