import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { ConversationListItem as ConvItem } from '@smartshaadi/types'
import ChatsListClient from '@/components/chat/ChatsListClient.client'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Chats — Smart Shaadi' }

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
  const sp = await searchParams
  const filter: Filter =
    sp.filter === 'unread' || sp.filter === 'archived' ? sp.filter : 'all'

  const cookieStore = await cookies()
  const token = cookieStore.get('better-auth.session_token')?.value
  if (!token) redirect('/login')

  const [items, profileId] = await Promise.all([
    fetchConversations(token, filter),
    fetchProfileId(token),
  ])

  return (
    <main className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-gold/20 bg-surface/95 px-4 pt-4 pb-2 backdrop-blur-xl">
        <h1 className="font-heading text-xl font-semibold text-[#0F172A]">Chats</h1>
        <nav aria-label="Filter chats" className="mt-3 flex gap-1.5">
          <FilterTab href="/chats" label="All" active={filter === 'all'} />
          <FilterTab href="/chats?filter=unread" label="Unread" active={filter === 'unread'} />
          <FilterTab href="/chats?filter=archived" label="Archived" active={filter === 'archived'} />
        </nav>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-teal/10 text-3xl">
            💬
          </div>
          <p className="font-heading text-base font-semibold text-[#0F172A]">
            {filter === 'unread' ? 'You’re all caught up' : filter === 'archived' ? 'No archived chats' : 'No conversations yet'}
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {filter === 'all'
              ? 'Accept a match to start chatting and begin your journey together.'
              : 'Conversations you mark accordingly will appear here.'}
          </p>
          {filter === 'all' ? (
            <Link
              href="/matches"
              className="mt-5 inline-flex items-center justify-center rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal/25 transition-colors hover:bg-teal-hover"
            >
              Find matches
            </Link>
          ) : null}
        </div>
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
