import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { gasApi, type EarningsItem, type NewsItem } from '../api/gasApi'

// 뉴스+실적일 공유 훅 — NewsPanel(뉴스)·EventsPanel(실적일)이 같은 GAS 응답을 나눠 쓴다.
// 모듈 캐시 30분: 탭 재진입·패널 2곳 동시 마운트에도 GAS 호출 1회.
const CLIENT_CACHE_MS = 30 * 60 * 1000

interface NewsData {
  items: NewsItem[]
  earnings: EarningsItem[]
}

let cache: { at: number; data: NewsData } | null = null
let inflight: Promise<NewsData> | null = null

export function useNews() {
  const { token, isSignedIn } = useAuth()
  const [data, setData] = useState<NewsData | null>(cache ? cache.data : null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    if (cache && Date.now() - cache.at < CLIENT_CACHE_MS) {
      setData(cache.data)
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (!inflight) {
        inflight = gasApi.getNews(token).then((res) => {
          if (!res.success) throw new Error(res.error || 'unknown')
          const d: NewsData = { items: res.items ?? [], earnings: res.earnings ?? [] }
          cache = { at: Date.now(), data: d }
          return d
        }).finally(() => { inflight = null })
      }
      setData(await inflight)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  return { isSignedIn, loading, error, items: data?.items ?? null, earnings: data?.earnings ?? [] }
}
