'use client'

import { useEffect, useRef } from 'react'
import { Reply, Smile, Pencil, Trash2, Copy, Forward, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageMenuProps {
  open:           boolean
  align:          'left' | 'right'
  canEdit:        boolean
  canDelete:      boolean
  onReply:        () => void
  onReact:        () => void
  onEdit?:        () => void
  onDelete?:      () => void
  onCopy?:        () => void
  onForward?:     () => void
  onInfo?:        () => void
  onClose:        () => void
}

export default function MessageMenu({
  open, align, canEdit, canDelete,
  onReply, onReact, onEdit, onDelete, onCopy, onForward, onInfo, onClose,
}: MessageMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      role="menu"
      className={cn(
        'absolute z-30 w-44 rounded-xl border border-gold/30 bg-surface shadow-xl py-1',
        align === 'right' ? 'right-0 top-9' : 'left-0 top-9',
      )}
    >
      <Item icon={<Reply className="h-4 w-4" />} label="Reply" onClick={() => { onReply(); onClose() }} />
      <Item icon={<Smile className="h-4 w-4" />} label="React" onClick={() => { onReact(); onClose() }} />
      {onCopy && <Item icon={<Copy className="h-4 w-4" />} label="Copy" onClick={() => { onCopy(); onClose() }} />}
      {onForward && <Item icon={<Forward className="h-4 w-4" />} label="Forward" onClick={() => { onForward(); onClose() }} />}
      {onInfo && <Item icon={<Info className="h-4 w-4" />} label="Info" onClick={() => { onInfo(); onClose() }} />}
      {canEdit && onEdit && (
        <Item icon={<Pencil className="h-4 w-4" />} label="Edit" onClick={() => { onEdit(); onClose() }} />
      )}
      {canDelete && onDelete && (
        <Item
          icon={<Trash2 className="h-4 w-4" />}
          label="Delete"
          danger
          onClick={() => { onDelete(); onClose() }}
        />
      )}
    </div>
  )
}

function Item({
  icon, label, danger, onClick,
}: { icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface-muted transition-colors',
        danger ? 'text-destructive' : 'text-foreground',
      )}
    >
      <span className={cn('shrink-0', danger ? 'text-destructive' : 'text-muted-foreground')}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  )
}
