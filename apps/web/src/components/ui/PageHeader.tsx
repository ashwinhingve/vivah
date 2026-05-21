import { Fragment, type ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  /** Right-aligned actions (desktop); stacks below the heading on mobile. */
  actions?: ReactNode;
  className?: string;
}

/** Consistent page header used at the top of every dashboard / feature page. */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
            {breadcrumbs.map((c, i) => (
              <Fragment key={`${c.label}-${i}`}>
                <li>
                  {c.href ? (
                    <Link href={c.href} className="transition-colors hover:text-primary">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-text-primary">
                      {c.label}
                    </span>
                  )}
                </li>
                {i < breadcrumbs.length - 1 && (
                  <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
              </Fragment>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-[22px] font-semibold leading-tight tracking-tight text-primary sm:text-[28px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
