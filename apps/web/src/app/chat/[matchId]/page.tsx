import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import ChatView from '@/components/chat/ChatView.client'
import VideoCallPanel from './VideoCallPanel.client'
import type { ChatMessage, ConversationParticipantPreview } from '@smartshaadi/types'

const BASE_URL = process.env['NEXT_PUBLIC_SOCKET_URL'] ?? 'http://localhost:4000'

export const metadata: Metadata = { title: 'Chat — Smart Shaadi' }

interface ConversationData {
  messages: ChatMessage[]
  total:    number
  other:    ConversationParticipantPreview | null
  settings?: { muted: boolean; archived: boolean; pinned: boolean; wallpaper: string | null }
  hasMore?: boolean
}

async function getConversation(
  matchId: string,
  token: string,
): Promise<{ data: ConversationData | null; error: boolean }> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/chat/conversations/${matchId}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return { data: null, error: true }
    const json = (await res.json()) as { success: boolean; data: ConversationData }
    return { data: json.success ? json.data : null, error: !json.success }
  } catch {
    return { data: null, error: true }
  }
}

async function getMyProfileId(token: string): Promise<string | null> {
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

interface ChatPageProps {
  params: Promise<{ matchId: string }>
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { matchId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('better-auth.session_token')?.value
  if (!token) redirect('/login')

  let userId = ''
  try {
    const meRes = await fetch(`${BASE_URL}/api/auth/get-session`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    })
    if (meRes.ok) {
      const meJson = (await meRes.json()) as { user?: { id: string } }
      userId = meJson.user?.id ?? ''
    }
  } catch {
    // Non-fatal — userId stays empty, redirect handles it
  }

  if (!userId) redirect('/login')

  const [{ data: conversation, error }, profileId] = await Promise.all([
    getConversation(matchId, token),
    getMyProfileId(token),
  ])

  const initialMessages: ChatMessage[] = (conversation?.messages ?? []).slice().reverse()
  const initialOther = conversation?.other ?? null
  const initialSettings = conversation?.settings ?? { muted: false, archived: false, pinned: false, wallpaper: null }
  const initialHasMore = conversation?.hasMore ?? false
  const initialTotal = conversation?.total ?? initialMessages.length

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background">
      {error ? (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Could not load conversation. Please refresh.
        </div>
      ) : null}

      <VideoCallPanel matchId={matchId} currentUserId={userId} />

      <ChatView
        matchId={matchId}
        currentUserId={userId}
        currentProfileId={profileId}
        authToken={token}
        initialMessages={initialMessages}
        initialOther={initialOther}
        initialSettings={initialSettings}
        initialHasMore={initialHasMore}
        initialTotal={initialTotal}
      />
    </main>
  )
}
