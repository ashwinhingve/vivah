import { Bell } from 'lucide-react';

export function ActivityFeed() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="mb-3 font-heading text-base font-semibold text-primary">
        Recent Activity
      </h2>
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-teal">
          <Bell className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="font-heading text-base font-semibold text-primary">No activity yet</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Match requests, responses, and booking updates will appear here.
        </p>
      </div>
    </div>
  );
}
