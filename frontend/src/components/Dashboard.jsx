import { useState, useEffect, useCallback, useRef } from 'react'
import DependencyGraph from './DependencyGraph'
import { apiFetch, clearToken } from '../api'
import Header from './Header'
import StatCards from './StatCards'
import ServerList from './ServerList'
import ServiceList from './ServiceList'
import ContainerGrid from './ContainerGrid'
import DetailPanel from './DetailPanel'
import { AddServiceModal, ServerModal } from './Modals'
import Toast from './Toast'
import { formatRelative } from './ui'

export default function Dashboard() {
  const [servers, setServers] = useState([])
  const [services, setServices] = useState([])
  const [containers, setContainers] = useState([])
  const [systemStats, setSystemStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [panel, setPanel] = useState(null)
  const [dark, setDark] = useState(true)
  const [showAddService, setShowAddService] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [showAddServer, setShowAddServer] = useState(false)
  const [editingServer, setEditingServer] = useState(null)
  const [version, setVersion] = useState(null)
  const [commit, setCommit] = useState(null)
  const [commitTime, setCommitTime] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [liveStatus, setLiveStatus] = useState('loading')
  const [now, setNow] = useState(Date.now())
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const latencyHistoryRef = useRef({})
  const historyStatsRef = useRef({})

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const prefersDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(prefersDark)
    document.documentElement.classList.toggle('dark', prefersDark)
  }, [])

  useEffect(() => {
    apiFetch('/api/version')
      .then(r => r.json())
      .then(d => {
        if (d && d.version) setVersion(d.version)
        if (d && d.commit) setCommit(d.commit)
        if (d && d.commit_time) setCommitTime(d.commit_time)
      })
      .catch(() => {})
  }, [])

  const statusIndicator = useCallback(() => {
    const downServers = servers.filter(s => !s.alive).length
    const downServices = services.filter(s => s.status === 'down').length
    const degradedServices = services.filter(s => s.status === 'degraded').length
    const incidents = downServers + downServices

    let color = '#10b981'
    let label = ''
    if (incidents > 0) {
      color = '#ef4444'
      label = `${incidents} incident${incidents !== 1 ? 's' : ''}`
    } else if (degradedServices > 0) {
      color = '#f59e0b'
      label = `${degradedServices} degraded`
    }

    document.title = label ? `${label} — HomeLab Monitor` : 'HomeLab Monitor'
    const link = document.querySelector('link[rel="icon"][type="image/svg+xml"]')
    if (link) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0f172a"/><circle cx="16" cy="16" r="9" fill="${color}"/></svg>`
      link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`
    }
  }, [servers, services])

  useEffect(() => {
    statusIndicator()
  }, [statusIndicator])

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

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // If data stops refreshing for more than a few cycles (even with the SSE
  // connection nominally open), the dashboard is effectively stale.
  useEffect(() => {
    if (lastUpdated && now - lastUpdated > 15000) {
      setLiveStatus('stale')
    }
  }, [now, lastUpdated])

  const openServer = (s) => setPanel({ type: 'server', item: s })
  const openService = (s) => setPanel({ type: 'service', item: s })
  const openContainer = (c) => setPanel({ type: 'container', item: c })
  const openSystem = () => setPanel({ type: 'system', item: systemStats })

  const confirmDelete = async (name) => {
    try {
      const res = await apiFetch(`/api/services/${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (!res.ok) {
        let msg = `Failed to delete (${res.status})`
        try {
          const data = await res.json()
          msg = data.error || msg
        } catch (_) {}
        throw new Error(msg)
      }
      showToast(`Deleted "${name}"`)
      fetchAll()
    } catch (e) {
      showToast(e.message || 'Failed to delete', 'error')
    }
  }

  const confirmServerDelete = async (name) => {
    try {
      const res = await apiFetch(`/api/servers/${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (!res.ok) {
        let msg = `Failed to delete (${res.status})`
        try {
          const data = await res.json()
          msg = data.error || msg
        } catch (_) {}
        throw new Error(msg)
      }
      showToast(`Deleted "${name}"`)
      fetchAll()
    } catch (e) {
      showToast(e.message || 'Failed to delete', 'error')
    }
  }

  const openEditServer = (s) => {
    setEditingServer({ name: s.name, host: s.host, port: s.port, type: s.type, gateway: s.gateway || '' })
  }

  const openEditService = () => {
    const s = panel?.item
    if (!s) return
    setPanel(null)
    setEditingService({ name: s.name, url: s.url, type: s.type })
  }

  const manualRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchAll()
    } finally {
      setRefreshing(false)
      setLastUpdated(Date.now())
    }
  }

  const exportConfig = async () => {
    try {
      const res = await apiFetch('/api/export')
      if (!res.ok) {
        let msg = `Failed to export (${res.status})`
        try {
          const data = await res.json()
          msg = data.error || msg
        } catch (_) {}
        throw new Error(msg)
      }
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'homelab-monitor-config.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      showToast('Config exported')
    } catch (e) {
      showToast(e.message || 'Failed to export', 'error')
    }
  }

  const importConfig = async (file) => {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!parsed || !Array.isArray(parsed.servers) || !Array.isArray(parsed.services)) {
        throw new Error('Invalid config file: expected servers and services arrays')
      }
      const res = await apiFetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      let data = {}
      try {
        data = await res.json()
      } catch (_) {}
      if (!res.ok) {
        throw new Error(data.error || `Failed to import (${res.status})`)
      }
      showToast(`Imported ${data.servers ?? 0} servers, ${data.services ?? 0} services, ${data.dependencies ?? 0} dependencies`)
      fetchAll()
    } catch (e) {
      showToast(e.message || 'Failed to import', 'error')
    }
  }

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const lockDashboard = () => {
    clearToken()
    window.dispatchEvent(new Event('auth:unauthorized'))
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
        </div>
        {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Header
        dark={dark}
        onToggleTheme={toggleTheme}
        onLock={lockDashboard}
        liveStatus={liveStatus}
        lastUpdated={lastUpdated}
        now={now}
        refreshing={refreshing}
        onManualRefresh={manualRefresh}
        onExport={exportConfig}
        onImport={importConfig}
        version={version}
        commit={commit}
        commitTime={commitTime}
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <StatusBanner servers={servers} services={services} containers={containers} />

      <StatCards
        servers={servers}
        services={services}
        containers={containers}
        systemStats={systemStats}
        onScrollServers={() => scrollToSection('servers-section')}
        onScrollServices={() => scrollToSection('services-section')}
        onScrollContainers={() => scrollToSection('containers-section')}
        onOpenSystem={openSystem}
      />

      <ServerList
        servers={servers}
        latencyHistory={latencyHistoryRef.current}
        onOpen={openServer}
        onEdit={openEditServer}
        onDelete={confirmServerDelete}
        onAdd={() => setShowAddServer(true)}
      />

      <ServiceList
        services={services}
        latencyHistory={latencyHistoryRef.current}
        historyStats={historyStatsRef.current}
        onOpen={openService}
        onDelete={confirmDelete}
        onAdd={() => setShowAddService(true)}
      />

      <ContainerGrid
        containers={containers}
        onOpen={openContainer}
      />

      <DependencyGraph
        servers={servers}
        services={services}
        containers={containers}
        dark={dark}
        onOpenServer={openServer}
        onOpenService={openService}
        onOpenContainer={openContainer}
        showToast={showToast}
      />

      {showAddServer && <ServerModal onClose={() => setShowAddServer(false)} onAdded={() => { fetchAll(); showToast('Server added') }} onError={msg => showToast(msg, 'error')} />}
      {editingServer && <ServerModal initial={editingServer} onClose={() => setEditingServer(null)} onAdded={() => { fetchAll(); showToast('Server updated') }} onError={msg => showToast(msg, 'error')} />}
      {showAddService && <AddServiceModal onClose={() => setShowAddService(false)} onAdded={() => { fetchAll(); showToast('Service added') }} onError={msg => showToast(msg, 'error')} />}
      {editingService && <AddServiceModal initial={editingService} onClose={() => setEditingService(null)} onAdded={() => { fetchAll(); showToast('Service updated') }} onError={msg => showToast(msg, 'error')} />}

      <DetailPanel
        item={panel?.item}
        type={panel?.type}
        onClose={() => setPanel(null)}
        onEdit={openEditService}
        latencyHistory={latencyHistoryRef.current[panel?.item?.name]}
        historyStats={historyStatsRef.current[`${panel?.type}:${panel?.item?.name}`]}
        systemStats={systemStats}
      />

      <Toast toast={toast} />

      <footer className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 flex-wrap text-xs text-gray-400">
        <span>HomeLab Monitor</span>
        <a href="https://github.com/diptamahardhika/homelab-monitor" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 dark:hover:text-gray-300">
          {commit ? (
            <span className="font-mono">{commit}{commitTime && ` · ${formatRelative(new Date(commitTime).getTime(), now)}`}</span>
          ) : version && <span className="font-mono">v{version}</span>}
        </a>
      </footer>
    </div>
  )
}

function StatusBanner({ servers, services, containers }) {
  const serverDown = servers.filter(s => !s.alive)
  const servicesDown = services.filter(s => s.status !== 'up')
  const hasTargets = servers.length > 0 || services.length > 0
  const running = containers.filter(c => c.state === 'running').length

  if (!hasTargets) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Nothing configured yet — add a server or service to start monitoring.</span>
      </div>
    )
  }

  const issues = [
    ...serverDown.map(s => `server "${s.name}"`),
    ...servicesDown.map(s => `service "${s.name}"`),
  ]

  if (issues.length === 0) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span className="font-medium">All systems operational</span>
        <span className="ml-auto hidden sm:inline text-xs opacity-70">
          {servers.length} server{servers.length !== 1 ? 's' : ''} · {services.length} service{services.length !== 1 ? 's' : ''} · {running} container{running !== 1 ? 's' : ''} running
        </span>
      </div>
    )
  }

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
      <span className="font-medium shrink-0">{issues.length} incident{issues.length !== 1 ? 's' : ''}</span>
      <span className="truncate text-xs opacity-80">
        {issues.slice(0, 3).join(', ')}{issues.length > 3 ? ` +${issues.length - 3} more` : ''}
      </span>
    </div>
  )
}