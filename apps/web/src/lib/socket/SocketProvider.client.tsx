'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { io, type Socket } from 'socket.io-client'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'

function getSessionToken(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(/(?:^|;\s*)better-auth\.session_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]!) : ''
}

const SocketContext = createContext<Socket | null>(null)

export function useChatSocket(): Socket | null {
  return useContext(SocketContext)
}

interface SocketProviderProps {
  children: ReactNode
}

export function SocketProvider({ children }: SocketProviderProps) {
  const socketRef = useRef<Socket | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const hiddenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const token = getSessionToken()

    const s = io(`${API_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
    })

    socketRef.current = s
    setSocket(s)

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenTimerRef.current = setTimeout(() => {
          socketRef.current?.disconnect()
        }, 5 * 60 * 1000)
      } else {
        if (hiddenTimerRef.current) {
          clearTimeout(hiddenTimerRef.current)
          hiddenTimerRef.current = null
        }
        if (socketRef.current && !socketRef.current.connected) {
          socketRef.current.connect()
        }
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current)
      s.disconnect()
    }
  }, [])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}
