import { cookies } from 'next/headers'
import { redirect } from '@/i18n/redirect';
import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import type { ConversationListItem as ConvItem } from '@smartshaadi/types'
import ChatsListClient from '@/components/chat/ChatsListClient.client'
import { EmptyState } from '@/components/ui/EmptyState'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'chats.metadata' });
  return { title: t('title') };
}

const BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'

type Filter = 'all' | 'unread' | 'archived'

async function fetchConversations(token: string, filter: Filter): Promise<ConvItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/chat/conversations?filter=${filter}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const j = (await res.json()) as { success: boolean; data: { items: ConvItem[] } }
    return j.success ? (j.data?.items ?? []) : []
  } catch {
    return []
  }
}

async function fetchProfileId(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/profiles/me`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const j = (await res.json()) as { success: boolean; data: { id: string } }
    return j.success ? j.data.id : null
  } catch {
    return null
  }
}

interface PageProps {
  searchParams: Promise<{ filter?: string }>
}

export default async function ChatsPage({ searchParams }: PageProps) {
  const t = await getTranslations('chats');
  const sp = await searchParams
  const filter: Filter =
    sp.filter === 'unread' || sp.filter === 'archived' ? sp.filter : 'all'

  const cookieStore = await cookies()
  const token = cookieStore.get('better-auth.session_token')?.value
  if (!token) return await redirect('/login')

  const [items, profileId] = await Promise.all([
    fetchConversations(token, filter),
    fetchProfileId(token),
  ])

  return (
    <main id="main-content" className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-gold/20 bg-surface/95 px-4 pt-4 pb-2 backdrop-blur-xl">
        <h1 className="font-heading text-xl font-semibold text-foreground">{t('heading')}</h1>
        <nav aria-label="Filter chats" className="mt-3 flex gap-1.5">
          <FilterTab href="/chats" label="All" active={filter === 'all'} />
          <FilterTab href="/chats?filter=unread" label="Unread" active={filter === 'unread'} />
          <FilterTab href="/chats?filter=archived" label="Archived" active={filter === 'archived'} />
        </nav>
      </header>

      {items.length === 0 ? (
        <EmptyState
          variant="no-messages"
          title={
            filter === 'unread'
              ? 'You’re all caught up'
              : filter === 'archived'
              ? 'No archived chats'
              : 'No conversations yet'
          }
          description={
            filter === 'all'
              ? 'Accept a match to start chatting and begin your journey together.'
              : 'Conversations you mark accordingly will appear here.'
          }
          {...(filter === 'all'
            ? { actionLabel: 'Find matches', actionHref: '/matches' }
            : {})}
        />
      ) : (
        <ChatsListClient
          initialItems={items}
          currentProfileId={profileId ?? ''}
          authToken={token}
        />
      )}
    </main>
  )
}

function FilterTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'inline-flex items-center rounded-full bg-teal px-3.5 py-1.5 text-xs font-semibold text-white'
          : 'inline-flex items-center rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground'
      }
    >
      {label}
    </Link>
  )
}
