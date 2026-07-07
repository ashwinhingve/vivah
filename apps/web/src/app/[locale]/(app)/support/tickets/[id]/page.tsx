import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/redirect';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Link2, Clock, User } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { PriorityPill, StatusPill, SlaBadge } from '@/components/support/badges';
import { TicketThread } from '@/components/support/TicketThread.client';
import { TicketActionsPanel } from '@/components/support/TicketActionsPanel.client';
import { fetchTicket } from '@/lib/support-api';

export const metadata = { title: 'Ticket · Support' };
export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = {
  USER: 'Raised by user',
  CHAT_REPORT: 'From chat report',
  DISPUTE: 'From booking dispute',
  KYC_APPEAL: 'From KYC appeal',
  SYSTEM: 'System-generated',
};

function linkedHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  if (type === 'CHAT_REPORT') return '/support/reports';
  if (type === 'DISPUTE') return '/admin/escrow';
  if (type === 'KYC_APPEAL') return '/admin/kyc';
  return null;
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'SUPPORT' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const { id } = await params;
  const ticket = await fetchTicket(id);
  if (!ticket) return notFound();

  const href = linkedHref(ticket.linkedRefType, ticket.linkedRefId);

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
        <FadeUp>
          <Link
            href="/support"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to queue
          </Link>

          <div className="mb-6 rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-heading text-2xl text-primary">{ticket.subject}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {ticket.raisedByName ?? 'Unknown'} · {SOURCE_LABEL[ticket.source] ?? ticket.source}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(ticket.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="capitalize">{ticket.category.replace('_', ' ').toLowerCase()}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PriorityPill priority={ticket.priority} />
                <StatusPill status={ticket.status} />
                <SlaBadge slaDueAt={ticket.slaDueAt} overdue={ticket.overdue} />
              </div>
            </div>

            {ticket.description && (
              <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm text-text">
                {ticket.description}
              </p>
            )}

            {ticket.linkedRefType && (
              <div className="mt-4 border-t border-border pt-4">
                {href ? (
                  <Link
                    href={href}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:underline"
                  >
                    <Link2 className="h-4 w-4" /> View linked {ticket.linkedRefType.replace('_', ' ').toLowerCase()}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
                    <Link2 className="h-4 w-4" /> Linked to {ticket.linkedRefType.replace('_', ' ').toLowerCase()}
                  </span>
                )}
              </div>
            )}
          </div>
        </FadeUp>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FadeUp>
              <TicketThread ticketId={ticket.id} messages={ticket.messages} myUserId={me?.userId ?? ''} />
            </FadeUp>
          </div>
          <div className="space-y-6">
            <FadeUp>
              <TicketActionsPanel
                ticketId={ticket.id}
                status={ticket.status}
                priority={ticket.priority}
                assignedToName={ticket.assignedToName}
                myUserId={me?.userId ?? ''}
              />
            </FadeUp>

            {ticket.events.length > 0 && (
              <FadeUp>
                <div className="rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
                  <h2 className="mb-4 font-heading text-lg text-primary">History</h2>
                  <ol className="space-y-3">
                    {ticket.events.map((ev) => (
                      <li key={ev.id} className="flex gap-3 text-xs">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" />
                        <div>
                          <p className="text-primary">
                            <span className="font-medium">{ev.eventType.replace(/_/g, ' ').toLowerCase()}</span>
                            {ev.actorName ? ` · ${ev.actorName}` : ''}
                          </p>
                          <p className="text-text-muted">
                            {new Date(ev.createdAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </FadeUp>
            )}
          </div>
        </div>
      </main>
    </PageTransition>
  );
}
