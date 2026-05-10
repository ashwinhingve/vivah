import { fetchFaqSummary } from '@/lib/wedding-api';
import { CeremonyAttendanceCard } from './CeremonyAttendanceCard';

interface Props {
  weddingId: string;
}

export async function CateringEstimates({ weddingId }: Props) {
  const summary = await fetchFaqSummary(weddingId);

  if (!summary || summary.ceremonies.length === 0) {
    return (
      <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-8 text-center">
        <p className="text-muted-foreground">
          Catering estimates will appear once guests RSVP.
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
        * Catering count includes a 10% buffer for over-attendance.
      </p>
    </div>
  );
}
