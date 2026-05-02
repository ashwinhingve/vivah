'use client'

import type { ReactNode } from 'react'
import { SocketProvider } from '@/lib/socket/SocketProvider.client'

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <SocketProvider>
      <div className="flex flex-col min-h-screen">{children}</div>
    </SocketProvider>
  )
}
