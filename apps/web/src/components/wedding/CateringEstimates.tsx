import { getTranslations } from 'next-intl/server';
import { fetchFaqSummary } from '@/lib/wedding-api';
import { CeremonyAttendanceCard } from './CeremonyAttendanceCard';

interface Props {
  weddingId: string;
}

export async function CateringEstimates({ weddingId }: Props) {
  const t = await getTranslations('catering');
  const summary = await fetchFaqSummary(weddingId);

  if (!summary || summary.ceremonies.length === 0) {
    return (
      <div className="bg-surface border border-gold/20 rounded-2xl shadow-card p-8 text-center">
        <p className="text-muted-foreground">
          {t('emptyState')}
        </p>
      </div>
    );
  }

  return (
    <div>
      {summary.ceremonies.map((item) => (
        <CeremonyAttendanceCard
          key={item.ceremony_id}
          weddingId={weddingId}
          summaryItem={item}
        />
      ))}
      <p className="text-xs italic text-muted-foreground mt-4">
        * {t('bufferNote')}
      </p>
    </div>
  );
}
