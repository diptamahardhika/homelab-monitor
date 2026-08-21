import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../api'

// useOverview owns the live dashboard dataset: overview fetch/apply, the SSE
// subscription with polling fallback, visibility handling, staleness
// detection, and manual refresh.
export function useOverview(now) {
  const [servers, setServers] = useState([])
  const [services, setServices] = useState([])
  const [containers, setContainers] = useState([])
  const [systemStats, setSystemStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [liveStatus, setLiveStatus] = useState('loading')
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const latencyHistoryRef = useRef({})
  const historyStatsRef = useRef({})

  const applyData = useCallback((overview, hist) => {
    const serversData = Array.isArray(overview.servers) ? overview.servers : []
    const servicesData = Array.isArray(overview.services) ? overview.services : []
    setServers(serversData)
    setServices(servicesData)
    setContainers(Array.isArray(overview.containers) ? overview.containers : [])
    setSystemStats(overview.system)
    historyStatsRef.current = hist && typeof hist === 'object' ? hist : {}

    const newHistory = { ...latencyHistoryRef.current }
    for (const item of [...serversData, ...servicesData]) {
      if (!newHistory[item.name]) newHistory[item.name] = []
      const val = parseInt(item.latency, 10)
      if (!isNaN(val)) {
        newHistory[item.name].push(val)
      }
      if (newHistory[item.name].length > 30) {
        newHistory[item.name].shift()
      }
    }
    latencyHistoryRef.current = newHistory

    setError(null)
    setLastUpdated(Date.now())
  }, [])

  const fetchAll = useCallback(async () => {
    try {
      const [overview, hist] = await Promise.all([
        apiFetch('/api/overview').then(r => r.json()),
        apiFetch('/api/history').then(r => r.json()).catch(() => ({})),
      ])
      applyData(overview, hist)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [applyData])

  const manualRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchAll()
    } finally {
      setRefreshing(false)
      setLastUpdated(Date.now())
    }
  }

  useEffect(() => {
    let es = null
    let interval = null
    let polling = false

    const startPolling = () => {
      if (!polling) {
        polling = true
        setLiveStatus('polling')
        interval = setInterval(fetchAll, 3000)
      }
    }
    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
      polling = false
    }

    // SSE pushes every refresh; on failure EventSource auto-reconnects while we
    // fall back to polling so the dashboard stays live (and 401s surface to the
    // token gate via apiFetch).
    const connectSSE = () => {
      setLiveStatus('loading')
      es = new EventSource('/api/events')
      es.onopen = () => {
        setLiveStatus('live')
        stopPolling()
      }
      es.onmessage = (ev) => {
        setLiveStatus('live')
        try {
          const data = JSON.parse(ev.data)
          applyData(data.overview, data.history)
        } catch (_) {}
      }
      es.onerror = () => {
        setLiveStatus('polling')
        if (!document.hidden) startPolling()
      }
    }
    const closeSSE = () => {
      if (es) {
        es.close()
        es = null
      }
    }

    const onVisibility = () => {
      if (document.hidden) {
        closeSSE()
        stopPolling()
      } else {
        fetchAll().then(connectSSE)
      }
    }

    fetchAll().then(connectSSE)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      closeSSE()
      stopPolling()
    }
  }, [fetchAll, applyData])

  // If data stops refreshing for more than a few cycles (even with the SSE
  // connection nominally open), the dashboard is effectively stale.
  useEffect(() => {
    if (lastUpdated && now - lastUpdated > 15000) {
      setLiveStatus('stale')
    }
  }, [now, lastUpdated])

  return {
    servers,
    services,
    containers,
    systemStats,
    loading,
    error,
    liveStatus,
    lastUpdated,
    refreshing,
    latencyHistoryRef,
    historyStatsRef,
    fetchAll,
    manualRefresh,
  }
}
