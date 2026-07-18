/**
 * PDF report download control (Phase 8 · Unit 8.3).
 *
 * A plain anchor, deliberately: the API streams the PDF and sets its own
 * Content-Disposition, so a normal cross-origin navigation carries the session
 * cookie and lets the browser handle the download. Fetching it into JS instead
 * would mean buffering the whole PDF in memory and re-deriving the filename for
 * an object URL, for no gain — so this stays a Server Component with no
 * client-side JavaScript at all.
 *
 * Cross-origin cookie behaviour is per ADR-002 (SameSite=None; Secure in prod).
 */

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface ReportDownloadButtonProps {
  /** API path under /api/v1/reports, e.g. '/admin/platform-report'. */
  path:   string;
  label:  string;
  /** Optional helper text rendered under the button. */
  hint?:  string;
}

export function ReportDownloadButton({
  path,
  label,
  hint,
}: ReportDownloadButtonProps): React.ReactNode {
  return (
    <div className="flex flex-col gap-1">
      <a
        href={`${API_BASE}/api/v1/reports${path}`}
        // The API sets the real filename via Content-Disposition; the bare
        // attribute just marks this as a download rather than a navigation.
        download
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"
          />
        </svg>
        {label}
      </a>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}
