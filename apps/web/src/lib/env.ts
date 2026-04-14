// Server-side env (never exposed to browser)
export const serverEnv = {
  apiUrl: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1',
};

// Client-safe env (all NEXT_PUBLIC_)
export const clientEnv = {
  apiUrl:    process.env['NEXT_PUBLIC_API_URL']    ?? 'http://localhost:4000/api/v1',
  socketUrl: process.env['NEXT_PUBLIC_SOCKET_URL'] ?? 'http://localhost:4000',
  appName:   process.env['NEXT_PUBLIC_APP_NAME']   ?? 'Smart Shaadi',
};
