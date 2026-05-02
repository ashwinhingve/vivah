interface DateSeparatorProps {
  iso: string
}

function formatLabel(d: Date): string {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const isSame = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (isSame(d, today)) return 'Today'
  if (isSame(d, yesterday)) return 'Yesterday'
  const sameYear = d.getFullYear() === today.getFullYear()
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export default function DateSeparator({ iso }: DateSeparatorProps) {
  const label = formatLabel(new Date(iso))
  return (
    <div className="flex w-full items-center justify-center py-2">
      <span className="rounded-full bg-surface-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  )
}
