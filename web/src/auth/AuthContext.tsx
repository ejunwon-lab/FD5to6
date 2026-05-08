import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { KEY_STORAGE, gasApi } from '../api/gasApi'

interface AuthState {
  isSignedIn: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  signIn: (key: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ isSignedIn: false, isLoading: true })

  useEffect(() => {
    const key = localStorage.getItem(KEY_STORAGE)
    setState({ isSignedIn: !!key, isLoading: false })
  }, [])

  // gas-unauthorized 이벤트 수신 시 자동 로그아웃
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(KEY_STORAGE)
      setState({ isSignedIn: false, isLoading: false })
    }
    window.addEventListener('gas-unauthorized', handler)
    return () => window.removeEventListener('gas-unauthorized', handler)
  }, [])

  const signIn = useCallback(async (key: string) => {
    localStorage.setItem(KEY_STORAGE, key)
    await gasApi.ping() // 키 유효성 검증 — UNAUTHORIZED면 예외 발생
    setState({ isSignedIn: true, isLoading: false })
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem(KEY_STORAGE)
    setState({ isSignedIn: false, isLoading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
