import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { gasApi, type MonthlyRealizedItem } from '../api/gasApi'

interface State {
  loading: boolean
  error: string | null
  entries: MonthlyRealizedItem[]
}

export function useRealized() {
  const { isSignedIn, getToken } = useAuth()
  const [state, setState] = useState<State>({ loading: false, error: null, entries: [] })

  const refresh = useCallback(async () => {
    if (!isSignedIn) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const token = await getToken()
      const res = await gasApi.getMonthlyRealized(token)
      setState({
        loading: false,
        error: res.success ? null : (res.error ?? '실현 손익 조회 실패'),
        entries: res.entries ?? [],
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setState({ loading: false, error: msg, entries: [] })
    }
  }, [isSignedIn, getToken])

  useEffect(() => {
    if (isSignedIn) refresh()
  }, [isSignedIn, refresh])

  return { ...state, refresh }
}
