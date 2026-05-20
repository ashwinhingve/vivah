// Server component — renders KYC audit trail.
interface AuditEntry {
  id:        string;
  eventType: string;
  actorRole: string | null;
  fromStatus: string | null;
  toStatus:   string | null;
  fromLevel:  string | null;
  toLevel:    string | null;
  metadata:   Record<string, unknown> | null;
  createdAt:  string;
}

const LABELS: Record<string, string> = {
  INITIATED:                'Verification started',
  AADHAAR_VERIFIED:         'Aadhaar verified via DigiLocker',
  AADHAAR_FAILED:           'Aadhaar verification failed',
  PHOTO_ANALYZED:           'Profile photo analysed',
  LIVENESS_CHECKED:         'Liveness selfie checked',
  FACE_MATCH_CHECKED:       'Face matched to Aadhaar photo',
  PAN_VERIFIED:             'PAN verified',
  PAN_FAILED:               'PAN verification failed',
  BANK_VERIFIED:            'Bank account verified',
  BANK_FAILED:              'Bank verification failed',
  DOCUMENT_UPLOADED:        'Supplementary document uploaded',
  DOCUMENT_VERIFIED:        'Document verified',
  DOCUMENT_REJECTED:        'Document rejected',
  SANCTIONS_CHECKED:        'Sanctions screening completed',
  SANCTIONS_HIT:            'Sanctions screening flagged',
  RISK_SCORED:              'Risk score recomputed',
  AUTO_VERIFIED:            'Automatically verified',
  AUTO_REJECTED:            'Automatically rejected',
  MANUAL_APPROVED:          'Approved by reviewer',
  MANUAL_REJECTED:          'Rejected by reviewer',
  INFO_REQUESTED:           'Reviewer requested more info',
  INFO_PROVIDED:            'Additional info provided',
  APPEAL_FILED:             'Appeal filed',
  APPEAL_UPHELD:            'Appeal upheld — reinstated',
  APPEAL_DENIED:            'Appeal denied',
  REVERIFICATION_REQUESTED: 'Re-verification started',
  EXPIRED:                  'Verification expired',
  LOCKED:                   'Verification locked due to attempts',
  UNLOCKED:                 'Verification unlocked',
  LEVEL_UPGRADED:           'Verification level upgraded',
};

const POSITIVE = new Set(['AADHAAR_VERIFIED','PAN_VERIFIED','BANK_VERIFIED','DOCUMENT_VERIFIED','MANUAL_APPROVED','AUTO_VERIFIED','APPEAL_UPHELD','LEVEL_UPGRADED','UNLOCKED']);
const NEGATIVE = new Set(['AADHAAR_FAILED','PAN_FAILED','BANK_FAILED','DOCUMENT_REJECTED','MANUAL_REJECTED','AUTO_REJECTED','APPEAL_DENIED','SANCTIONS_HIT','EXPIRED','LOCKED']);

function fmt(d: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(d));
}

export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-center">
        <p className="text-sm text-muted-foreground">No verification events yet.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Verification timeline</h3>
        <span className="text-[11px] text-muted-foreground">{entries.length} event{entries.length === 1 ? '' : 's'}</span>
      </div>
      <ol className="space-y-0">
        {entries.map((e, i) => {
          const tone = POSITIVE.has(e.eventType) ? 'success' : NEGATIVE.has(e.eventType) ? 'destructive' : 'muted';
          const dotClass = tone === 'success' ? 'bg-success' : tone === 'destructive' ? 'bg-destructive' : 'bg-muted-foreground';
          const last = i === entries.length - 1;
          return (
            <li key={e.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <span className={`w-2.5 h-2.5 rounded-full mt-2 ${dotClass}`} aria-hidden="true" />
                {!last && <span className="w-px flex-1 bg-border mt-1" aria-hidden="true" />}
              </div>
              <div className={`flex-1 pb-4 ${last ? '' : 'border-b-0'}`}>
                <p className="text-sm font-medium text-foreground">
                  {LABELS[e.eventType] ?? e.eventType.replace(/_/g, ' ').toLowerCase()}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {fmt(e.createdAt)}
                  {e.actorRole && <span className="ml-2 px-1.5 py-0.5 rounded bg-muted/40">{e.actorRole}</span>}
                </p>
                {e.toStatus && e.fromStatus && e.fromStatus !== e.toStatus && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Status: {e.fromStatus} → <strong className="text-foreground">{e.toStatus}</strong>
                  </p>
                )}
                {e.toLevel && e.fromLevel && e.fromLevel !== e.toLevel && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Level: {e.fromLevel} → <strong className="text-foreground">{e.toLevel}</strong>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
