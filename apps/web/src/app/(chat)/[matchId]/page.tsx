import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import ChatView from '@/components/chat/ChatView.client'
import type { ChatMessage } from '@smartshaadi/types'

// Base server URL — no /api/v1 suffix (used for /api/auth/* and /api/v1/* paths)
const BASE_URL = process.env['NEXT_PUBLIC_SOCKET_URL'] ?? 'http://localhost:4000'

export const metadata: Metadata = { title: 'Chat — Smart Shaadi' }

interface ConversationData {
  messages: ChatMessage[]
  total: number
  participantName?: string
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
    return {
      data: json.success ? json.data : null,
      error: !json.success,
    }
  } catch {
    return { data: null, error: true }
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

  // Resolve userId via Better Auth session endpoint
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
    // Non-fatal — userId stays empty, ChatView won't render
  }

  if (!userId) redirect('/login')

  const { data: conversation, error } = await getConversation(matchId, token)
  const initialMessages: ChatMessage[] = conversation?.messages ?? []

  return (
    <main className="min-h-screen bg-[#FEFAF6] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#C5A47E]/20 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link
          href="/matches"
          aria-label="Back to matches"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#6B6B76] hover:bg-[#FEFAF6] transition-colors shrink-0 -ml-2"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#0E7C7B]/10 flex items-center justify-center shrink-0 text-[#0E7C7B] font-semibold text-sm">
            {conversation?.participantName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#0F172A] truncate font-heading">
              {conversation?.participantName ?? 'Chat'}
            </p>
            <p className="text-xs text-[#6B6B76]">Match conversation</p>
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/20 px-4 py-3 text-sm text-[#DC2626]"
        >
          Could not load conversation. Please refresh.
        </div>
      )}

      <ChatView
        matchId={matchId}
        currentUserId={userId}
        authToken={token}
        initialMessages={initialMessages}
      />
    </main>
  )
}
