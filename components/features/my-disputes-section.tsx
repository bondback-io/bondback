import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, AlertTriangle, Upload } from "lucide-react";

export type MyDisputeItem = {
  jobId: number;
  title: string;
  suburb: string;
  postcode?: string;
  disputedByLabel: string;
  reasonShort: string;
};

type MyDisputesSectionProps = {
  disputes: MyDisputeItem[];
};

export function MyDisputesSection({ disputes }: MyDisputesSectionProps) {
  if (disputes.length === 0) {
    return (
      <Card className="border-border dark:border-gray-800 dark:bg-gray-900/50">
        <CardHeader>
          <CardTitle className="text-base md:text-lg dark:text-gray-100 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            My Disputes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center dark:bg-gray-800/30">
            <p className="font-medium text-foreground dark:text-gray-100">
              No disputes on your jobs – keep up the good work!
            </p>
            <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
              If a dispute is raised, it will appear here and you can add evidence or view details.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border dark:border-gray-800 dark:bg-gray-900/50">
      <CardHeader>
        <CardTitle className="text-base md:text-lg dark:text-gray-100 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          My Disputes
        </CardTitle>
        <p className="text-xs text-muted-foreground dark:text-gray-400">
          Jobs where a dispute has been raised. Add evidence and track resolution.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {disputes.map((d) => (
            <div
              key={d.jobId}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 dark:border-gray-800 dark:bg-gray-900/50"
            >
              <div>
                <p className="font-semibold text-foreground dark:text-gray-100 line-clamp-2">
                  {d.title}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground dark:text-gray-400">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {d.suburb} {d.postcode ? ` ${d.postcode}` : ""}
                </p>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground dark:text-gray-400">Disputed by: </span>
                <span className="font-medium text-foreground dark:text-gray-100">{d.disputedByLabel}</span>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground dark:text-gray-400" title={d.reasonShort}>
                {d.reasonShort}
              </p>
              <Badge variant="secondary" className="w-fit text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Under review
              </Badge>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="text-xs">
                  <Link href={`/jobs/${d.jobId}`}>View Details</Link>
                </Button>
                <Button asChild size="sm" variant="ghost" className="text-xs">
                  <Link href={`/jobs/${d.jobId}?upload=evidence`}>
                    <Upload className="mr-1 h-3 w-3" />
                    Upload More Evidence
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
