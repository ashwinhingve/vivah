'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProfileCard } from '@/components/ui/ProfileCard.client';
import { CompatibilityScore } from '@/components/ui/CompatibilityScore.client';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  ProfileCardSkeleton,
  ListItemSkeleton,
  DashboardCardSkeleton,
  ChatMessageSkeleton,
  TableRowSkeleton,
} from '@/components/ui/SkeletonLoader';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatCard } from '@/components/ui/StatCard';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback.client';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { StaggerList } from '@/components/motion/StaggerList.client';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber.client';
import {
  NoMatchesIllustration,
  NoMessagesIllustration,
  NoBookingsIllustration,
  NoVendorsIllustration,
  NoWeddingPlanIllustration,
  NoTasksIllustration,
  NoNotificationsIllustration,
  NoShortlistIllustration,
  NoSearchResultsIllustration,
  NoNetworkIllustration,
} from '@/components/ui/illustrations';

const SCORE_BANDS = [92, 78, 58, 40, 18];
const ILLUSTRATIONS = [
  ['No matches', NoMatchesIllustration],
  ['No messages', NoMessagesIllustration],
  ['No bookings', NoBookingsIllustration],
  ['No vendors', NoVendorsIllustration],
  ['No wedding', NoWeddingPlanIllustration],
  ['No tasks', NoTasksIllustration],
  ['No notifications', NoNotificationsIllustration],
  ['No shortlist', NoShortlistIllustration],
  ['No results', NoSearchResultsIllustration],
  ['No network', NoNetworkIllustration],
] as const;

const PHOTO =
  'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=480';
const BROKEN = 'https://images.pexels.com/photos/0/this-does-not-exist.jpeg';

const noop = () => {};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <SectionHeader title={title} />
      {children}
    </section>
  );
}

function ToastButtons() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="default" onClick={() => toast('Interest sent successfully', 'success')}>
        Success toast
      </Button>
      <Button variant="destructive" onClick={() => toast('Could not send interest', 'error')}>
        Error toast
      </Button>
      <Button variant="secondary" onClick={() => toast('Profile saved as draft', 'info')}>
        Info toast
      </Button>
    </div>
  );
}

export function UiPreview() {
  return (
    <ToastProvider>
      <PageTransition>
        <main className="mx-auto min-h-screen max-w-screen-lg bg-background px-4 py-8 sm:px-6">
          <PageHeader
            title="UI Component Foundation"
            subtitle="Visual QA surface for the UI overhaul sprint — Days 2–7 inherit these primitives."
            breadcrumbs={[{ label: 'Dev', href: '/' }, { label: 'UI Preview' }]}
            actions={<Button variant="secondary" size="sm">Dev only</Button>}
          />

          <Block title="Buttons — variants">
            <div className="flex flex-wrap gap-3">
              {(
                ['default', 'primary', 'brand', 'secondary', 'gold', 'outline', 'ghost', 'link', 'destructive', 'subtle'] as const
              ).map((v) => (
                <Button key={v} variant={v}>
                  {v}
                </Button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button size="sm">sm</Button>
              <Button size="default">md (default)</Button>
              <Button size="lg">lg</Button>
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
            </div>
          </Block>

          <Block title="Card — variants">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card padding="md">
                <Card.Header>
                  <h3 className="font-heading text-lg font-semibold text-primary">Default</h3>
                </Card.Header>
                <Card.Body>
                  <p className="text-sm text-text-muted">Gold hairline, soft burgundy shadow.</p>
                </Card.Body>
              </Card>
              <Card hover padding="md">
                <Card.Header>
                  <h3 className="font-heading text-lg font-semibold text-primary">Hover</h3>
                </Card.Header>
                <Card.Body>
                  <p className="text-sm text-text-muted">Lifts on hover (150ms).</p>
                </Card.Body>
              </Card>
              <Card premium padding="md">
                <Card.Header>
                  <h3 className="font-heading text-lg font-semibold text-primary">Premium</h3>
                </Card.Header>
                <Card.Body>
                  <p className="text-sm text-text-muted">Gold ring + glow.</p>
                </Card.Body>
              </Card>
            </div>
          </Block>

          <Block title="ProfileCard">
            <StaggerList className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <ProfileCard
                name="Ananya Sharma"
                age={27}
                city="Pune"
                profession="Architect"
                photoUrl={PHOTO}
                isNew
                isVerified
                isOnline
                compatibilityPct={92}
                gunaScore={30}
                onShortlist={noop}
                onConnect={noop}
                onPass={noop}
                onOpen={noop}
              />
              <ProfileCard
                name="Priya Nair"
                age={29}
                city="Kochi"
                profession="Doctor"
                photoUrl={null}
                isVerified
                compatibilityPct={84}
                gunaScore={26}
                shortlisted
                onShortlist={noop}
                onConnect={noop}
                onPass={noop}
              />
              <ProfileCard
                name="Broken Photo"
                age={31}
                city="Delhi"
                profession="Founder"
                photoUrl={BROKEN}
                compatibilityPct={71}
                onConnect={noop}
              />
              <ProfileCardSkeleton />
            </StaggerList>
          </Block>

          <Block title="CompatibilityScore">
            <div className="flex flex-wrap items-end gap-8">
              <CompatibilityScore value={92} variant="badge" />
              <CompatibilityScore value={92} variant="gauge" size={80} />
              <CompatibilityScore value={78} variant="gauge" size={120} />
              <div className="w-64">
                <CompatibilityScore value={64} variant="bar" />
              </div>
            </div>

            <p className="mb-3 mt-8 text-xs font-medium uppercase tracking-wide text-text-muted">
              Score bands (ladder)
            </p>
            <div className="flex flex-wrap items-end gap-6">
              {SCORE_BANDS.map((v) => (
                <CompatibilityScore key={v} value={v} variant="gauge" size={80} />
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {SCORE_BANDS.map((v) => (
                <CompatibilityScore key={v} value={v} variant="badge" />
              ))}
            </div>
          </Block>

          <Block title="StatCard">
            <div className="grid gap-4 sm:grid-cols-4">
              <StatCard label="Active matches" value={128} trendPct={12} />
              <StatCard label="Profile views" value={3460} trendPct={-4} />
              <StatCard label="Upcoming events" value={3} />
              <StatCard label="Shortlisted" value={42} trendPct={8} />
            </div>
          </Block>

          <Block title="EmptyState">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">
              Illustration family (cohesion check)
            </p>
            <div className="mb-6 grid grid-cols-3 gap-4 sm:grid-cols-6">
              {ILLUSTRATIONS.map(([label, Art]) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <Art className="h-24 w-24 text-primary/30" />
                  <span className="text-[11px] text-text-muted">{label}</span>
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                ['no-matches', 'no-messages', 'no-bookings', 'no-vendors', 'no-wedding', 'no-tasks'] as const
              ).map((v) => (
                <Card key={v}>
                  <EmptyState variant={v} actionHref="/" actionLabel="Take action" />
                </Card>
              ))}
            </div>
          </Block>

          <Block title="SkeletonLoader">
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileCardSkeleton />
              <div className="space-y-4">
                <ListItemSkeleton />
                <DashboardCardSkeleton />
                <Card padding="md">
                  <ChatMessageSkeleton />
                </Card>
                <Card>
                  <TableRowSkeleton />
                  <TableRowSkeleton />
                  <TableRowSkeleton />
                </Card>
              </div>
            </div>
          </Block>

          <Block title="Toast">
            <ToastButtons />
          </Block>

          <Block title="Motion — AnimatedNumber">
            <p className="font-heading text-5xl font-semibold text-primary">
              <AnimatedNumber value={2847} />
            </p>
          </Block>

          <Block title="ImageWithFallback">
            <div className="flex flex-wrap gap-4">
              <ImageWithFallback
                src={PHOTO}
                alt="Loaded"
                fill
                sizes="160px"
                wrapperClassName="h-40 w-32 rounded-2xl"
              />
              <ImageWithFallback
                src={BROKEN}
                alt="Broken"
                fill
                sizes="160px"
                wrapperClassName="h-40 w-32 rounded-2xl"
              />
              <ImageWithFallback
                src={null}
                alt="Empty"
                fill
                sizes="160px"
                wrapperClassName="h-40 w-32 rounded-2xl"
              />
            </div>
          </Block>
        </main>
      </PageTransition>
    </ToastProvider>
  );
}
