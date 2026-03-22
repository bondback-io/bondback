import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, HandCoins, SmilePlus } from "lucide-react";

const steps = [
  {
    title: "1. Create a listing",
    body: "Share your address, number of rooms, and extras like carpets or oven detailing. We focus on Australian postcodes and standards.",
    icon: ClipboardList,
  },
  {
    title: "2. Cleaners bid down",
    body: "Verified cleaners with an ABN bid lower than each other, in AUD. You see ratings, typical response time, and what’s included.",
    icon: HandCoins,
  },
  {
    title: "3. Lock in & get your bond back",
    body: "Pick the best bid at or under your reserve. Future escrow via Stripe will hold funds until the job is complete.",
    icon: SmilePlus,
  },
];

export const HowItWorks = () => {
  return (
    <section id="how-it-works" className="page-inner space-y-8 py-4">
      <div className="space-y-2">
        <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
          How Bond Back works
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          A simple three-step flow that gives listers clearer pricing and lets cleaners win more
          of the right jobs.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Card
              key={step.title}
              className="h-full border-border/70 shadow-md transition-shadow hover:shadow-lg"
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <CardTitle className="text-base md:text-lg">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground md:text-[15px]">{step.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
};

