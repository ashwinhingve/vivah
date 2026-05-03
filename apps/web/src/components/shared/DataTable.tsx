import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  /** Stable key — used for React keys. */
  key: string;
  /** Header label. */
  header: ReactNode;
  /** Cell renderer. Defaults to `String((row as any)[key])`. */
  render?: (row: T) => ReactNode;
  /** Optional Tailwind class applied to <td>. */
  cellClassName?: string;
  /** Optional Tailwind class applied to <th>. */
  headClassName?: string;
  /** Hide this column on mobile (rendered only as label/value pair on cards). */
  mobileLabel?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  empty?: { title: string; description?: string; action?: ReactNode };
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  className?: string;
}

function defaultRender<T>(row: T, key: string): ReactNode {
  const v = (row as Record<string, unknown>)[key];
  if (v == null) return <span className="text-muted-foreground">—</span>;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * DataTable — desktop table + mobile card-list, single source of truth for
 * tabular data across admin + payments. Loading state renders TableSkeleton
 * matching column count; empty state renders branded EmptyState.
 */
export function DataTable<T>({
  columns,
  data,
  loading,
  empty,
  rowKey,
  onRowClick,
  className,
}: DataTableProps<T>) {
  if (loading) return <TableSkeleton rows={5} cols={columns.length} className={className} />;
  if (data.length === 0) {
    return (
      <EmptyState
        title={empty?.title ?? 'Nothing here yet'}
        description={empty?.description}
        action={empty?.action}
        className={className}
      />
    );
  }

  return (
    <>
      {/* Desktop: real table */}
      <div className={cn('hidden overflow-hidden rounded-xl border border-border bg-surface shadow-card md:block', className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.headClassName}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer' : undefined}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.cellClassName}>
                    {col.render ? col.render(row) : defaultRender(row, col.key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: card list */}
      <ul className={cn('grid gap-3 md:hidden', className)}>
        {data.map((row, i) => {
          const Body = (
            <div className="space-y-2">
              {columns.map((col) => (
                <div key={col.key} className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gold-muted">
                    {col.mobileLabel ?? col.header}
                  </span>
                  <span className="text-right text-sm text-foreground">
                    {col.render ? col.render(row) : defaultRender(row, col.key)}
                  </span>
                </div>
              ))}
            </div>
          );
          return (
            <li
              key={rowKey(row, i)}
              className={cn(
                'rounded-xl border border-border bg-surface p-4 shadow-card',
                onRowClick && 'cursor-pointer transition-shadow hover:shadow-card-hover'
              )}
            >
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
                >
                  {Body}
                </button>
              ) : (
                Body
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
