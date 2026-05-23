import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/script.storage',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

const TOKEN_KEY = 'gis_access_token'
const EXPIRES_KEY = 'gis_expires_at'
const SILENT_TIMEOUT_MS = 3000

interface AuthState {
  isSignedIn: boolean
  token: string | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  signIn: () => void
  signOut: () => void
  getToken: () => Promise<string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace google.accounts.oauth2 {
    interface TokenClient {
      requestAccessToken(opts: { prompt: string }): void
    }
    interface TokenResponse {
      access_token: string
      expires_in: number
      error?: string
    }
    function initTokenClient(config: {
      client_id: string
      scope: string
      callback: (resp: TokenResponse) => void
    }): TokenClient
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isSignedIn: false,
    token: null,
    isLoading: true,
  })
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null)
  const resolversRef = useRef<Array<(token: string) => void>>([])
  const silentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSilentTimeout = useCallback(() => {
    if (silentTimeoutRef.current) {
      clearTimeout(silentTimeoutRef.current)
      silentTimeoutRef.current = null
    }
  }, [])

  const storeToken = useCallback((token: string, expiresIn: number) => {
    clearSilentTimeout()
    const expiresAt = Date.now() + expiresIn * 1000
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(EXPIRES_KEY, String(expiresAt))
    setState((s) => ({ ...s, isSignedIn: true, token, isLoading: false }))
    resolversRef.current.forEach((r) => r(token))
    resolversRef.current = []
  }, [clearSilentTimeout])

  const clearToken = useCallback(() => {
    clearSilentTimeout()
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EXPIRES_KEY)
    setState({ isSignedIn: false, token: null, isLoading: false })
  }, [clearSilentTimeout])

  const initClient = useCallback(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      console.error('VITE_GOOGLE_CLIENT_ID is not set')
      setState((s) => ({ ...s, isLoading: false }))
      return
    }
    tokenClientRef.current = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          clearToken()
          return
        }
        storeToken(response.access_token, response.expires_in)
      },
    })

    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedExpires = Number(localStorage.getItem(EXPIRES_KEY) ?? 0)
    if (savedToken && savedExpires > Date.now() + 60_000) {
      setState((s) => ({ ...s, isSignedIn: true, token: savedToken, isLoading: false }))
    } else {
      silentTimeoutRef.current = setTimeout(() => {
        silentTimeoutRef.current = null
        setState((s) => (s.isLoading ? { ...s, isLoading: false } : s))
      }, SILENT_TIMEOUT_MS)
      tokenClientRef.current?.requestAccessToken({ prompt: '' })
    }
  }, [storeToken, clearToken])

  useEffect(() => {
    let tries = 0
    const poll = setInterval(() => {
      tries++
      if (typeof google !== 'undefined') {
        clearInterval(poll)
        initClient()
      } else if (tries > 50) {
        clearInterval(poll)
        setState((s) => ({ ...s, isLoading: false }))
      }
    }, 100)
    return () => clearInterval(poll)
  }, [initClient])

  const signIn = useCallback(() => {
    tokenClientRef.current?.requestAccessToken({ prompt: 'select_account' })
  }, [])

  const signOut = useCallback(() => {
    clearToken()
  }, [clearToken])

  const getToken = useCallback((): Promise<string> => {
    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedExpires = Number(localStorage.getItem(EXPIRES_KEY) ?? 0)
    if (savedToken && savedExpires > Date.now() + 60_000) {
      return Promise.resolve(savedToken)
    }
    return new Promise<string>((resolve) => {
      resolversRef.current.push(resolve)
      tokenClientRef.current?.requestAccessToken({ prompt: '' })
    })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, getToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
