export default function ChatLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header skeleton */}
      <div className="bg-surface border-b border-gold/20 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-border animate-pulse shrink-0" />
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-border animate-pulse shrink-0" />
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <div className="h-4 w-32 rounded bg-border animate-pulse" />
            <div className="h-3 w-20 rounded bg-border animate-pulse" />
          </div>
        </div>
      </div>

      {/* Message skeletons */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Received */}
        <div className="flex justify-start">
          <div className="max-w-[65%] space-y-1">
            <div className="h-10 w-48 rounded-xl bg-border animate-pulse" />
            <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
          </div>
        </div>

        {/* Sent */}
        <div className="flex justify-end">
          <div className="max-w-[65%] space-y-1 flex flex-col items-end">
            <div className="h-10 w-56 rounded-xl bg-teal/20 animate-pulse" />
            <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
          </div>
        </div>

        {/* Received */}
        <div className="flex justify-start">
          <div className="max-w-[65%] space-y-1">
            <div className="h-16 w-64 rounded-xl bg-border animate-pulse" />
            <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
          </div>
        </div>

        {/* Sent */}
        <div className="flex justify-end">
          <div className="max-w-[65%] space-y-1 flex flex-col items-end">
            <div className="h-10 w-40 rounded-xl bg-teal/20 animate-pulse" />
            <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
          </div>
        </div>

        {/* Received */}
        <div className="flex justify-start">
          <div className="max-w-[65%] space-y-1">
            <div className="h-10 w-52 rounded-xl bg-border animate-pulse" />
            <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
          </div>
        </div>

        {/* Sent */}
        <div className="flex justify-end">
          <div className="max-w-[65%] space-y-1 flex flex-col items-end">
            <div className="h-12 w-44 rounded-xl bg-teal/20 animate-pulse" />
            <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
          </div>
        </div>
      </div>

      {/* Input skeleton */}
      <div className="bg-surface border-t border-gold/20 px-4 py-3">
        <div className="flex items-end gap-2">
          <div className="w-11 h-11 rounded-lg bg-border animate-pulse shrink-0" />
          <div className="flex-1 h-11 rounded-xl bg-border animate-pulse" />
          <div className="w-11 h-11 rounded-lg bg-teal/20 animate-pulse shrink-0" />
        </div>
      </div>
    </div>
  )
}
