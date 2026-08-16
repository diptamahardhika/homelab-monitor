import { useState, useEffect, useCallback, useRef } from 'react'

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}

function StatusBadge({ status }) {
  const colors = {
    up: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-300 dark:ring-emerald-500/30',
    down: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 ring-red-300 dark:ring-red-500/30',
    degraded: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-300 dark:ring-amber-500/30',
    running: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-300 dark:ring-emerald-500/30',
    exited: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-400 ring-gray-300 dark:ring-gray-500/30',
    paused: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-300 dark:ring-amber-500/30',
  }
  const c = colors[status] || 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-400 ring-gray-300 dark:ring-gray-500/30'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${c}`}>
      {status}
    </span>
  )
}

function Dot({ alive }) {
  return (
    <span
      className={`relative flex h-2.5 w-2.5 shrink-0 ${alive ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-red-500 dark:bg-red-400'}`}
      style={{ borderRadius: '50%', boxShadow: alive ? '0 0 8px rgba(52,211,153,0.5)' : '0 0 8px rgba(248,113,113,0.5)' }}
    />
  )
}

function LatencySparkline({ history, height = 32, width = 160 }) {
  if (!history || history.length < 2) return null

  const values = history.map(h => {
    if (typeof h === 'number') return h
    const n = parseInt(h, 10)
    return isNaN(n) ? 0 : n
  })

  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const area = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500">Latency (last {values.length} polls)</span>
        <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{values[values.length - 1]}ms</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id={`grad-${values.length}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(52,211,153)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(52,211,153)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <polygon
          fill={`url(#grad-${values.length})`}
          points={`0,${height} ${area} ${width},${height}`}
        />
        <polyline
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-emerald-500"
          points={points}
        />
      </svg>
    </div>
  )
}

function StatCard({ title, value, subtitle, accent, onClick }) {
  return (
    <button onClick={onClick} className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-5 backdrop-blur-sm transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm text-left w-full">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className={`mt-1 text-3xl font-bold ${accent || 'text-gray-900 dark:text-white'} transition-colors`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
    </button>
  )
}

function ServerCard({ server, onClick }) {
  return (
    <button onClick={onClick} className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-4 backdrop-blur-sm transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm text-left w-full">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{server.name}</h3>
          <p className="mt-0.5 text-sm text-gray-500 truncate">{server.host}{server.port ? `:${server.port}` : ''}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-xs text-gray-400">{server.latency}</span>
          <Dot alive={server.alive} />
        </div>
      </div>
      {server.error && <p className="mt-2 text-xs text-red-500 dark:text-red-400 truncate">{server.error}</p>}
    </button>
  )
}

function DetailPanel({ item, type, onClose, latencyHistory, statusHistory }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (item) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [item])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  return (
    <div className={`fixed inset-0 z-50 flex justify-end pointer-events-none ${visible ? 'pointer-events-auto' : ''}`} role="dialog">
      <div
        className={`absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <div
        className={`relative w-full max-w-lg bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 shadow-2xl overflow-y-auto transition-transform duration-200 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate pr-4">{item?.name || item?.title}</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {item && (
          <div className="p-6 space-y-6">
            {type === 'server' && <ServerDetail item={item} latencyHistory={latencyHistory} />}
            {type === 'service' && <ServiceDetail item={item} latencyHistory={latencyHistory} statusHistory={statusHistory} />}
            {type === 'container' && <ContainerDetail item={item} />}
            {type === 'system' && <SystemDetail stats={item} />}
          </div>
        )}
      </div>
    </div>
  )
}

function Bar({ value, label, valueLabel, color, total }) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0
  const bg = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-500',
  }[color] || 'bg-emerald-500'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm font-mono text-gray-500">{valueLabel}</span>
      </div>
      <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${bg}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s'
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(1)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`
}

function SystemDetail({ stats }) {
  if (!stats) return null

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">System</h3>
        <Bar
          label="CPU"
          value={stats.cpu_usage_percent}
          total={100}
          valueLabel={`${stats.cpu_usage_percent}%`}
          color="emerald"
        />
        <Bar
          label="Memory"
          value={stats.memory_used_mb}
          total={stats.memory_total_mb}
          valueLabel={`${stats.memory_used_mb} MB / ${stats.memory_total_mb} MB`}
          color="blue"
        />
        <Bar
          label="Storage"
          value={stats.disk_used_gb}
          total={stats.disk_total_gb}
          valueLabel={`${stats.disk_used_gb} GB / ${stats.disk_total_gb} GB`}
          color="amber"
        />
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Network</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              <span className="text-sm text-gray-500">Download</span>
            </div>
            <span className="text-sm font-mono text-gray-900 dark:text-white">{formatSpeed(stats.network_rx_speed)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              <span className="text-sm text-gray-500">Upload</span>
            </div>
            <span className="text-sm font-mono text-gray-900 dark:text-white">{formatSpeed(stats.network_tx_speed)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Hostname</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white truncate">{stats.hostname}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">OS</p>
            <p className="text-sm text-gray-900 dark:text-white truncate">{stats.os}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Kernel</p>
            <p className="text-sm text-gray-900 dark:text-white truncate">{stats.kernel}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Uptime</p>
            <p className="text-sm text-gray-900 dark:text-white">{stats.uptime || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">CPU Cores</p>
            <p className="text-sm text-gray-900 dark:text-white">{stats.cpu_count}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">IP Address</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white truncate">{stats.ip_address || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono, href }) {
  if (value === undefined || value === null || value === '') return null
  const content = href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 dark:hover:text-emerald-400 underline underline-offset-2 transition-colors">{value}</a>
    : value
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-gray-100 dark:border-gray-800/50 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className={`text-sm text-gray-900 dark:text-white text-right max-w-[60%] break-all ${mono ? 'font-mono text-xs' : ''}`}>{content}</span>
    </div>
  )
}

function ServerDetail({ item, latencyHistory }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Dot alive={item.alive} />
        <span className="text-sm text-gray-500">{item.alive ? 'Reachable' : 'Unreachable'}</span>
      </div>
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4 space-y-1">
        <DetailRow label="Host" value={`${item.host}${item.port ? `:${item.port}` : ''}`} mono />
        <DetailRow label="Type" value={item.type} />
        <DetailRow label="Latency" value={item.latency} />
        {item.error && <DetailRow label="Error" value={item.error} />}
      </div>
      {latencyHistory && <LatencySparkline history={latencyHistory} />}
    </div>
  )
}

function formatTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatBytes(n) {
  if (!n || n <= 0) return null
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function ServiceDetail({ item, latencyHistory, statusHistory }) {
  const uptimePct = statusHistory && statusHistory.length > 0
    ? Math.round((statusHistory.filter(Boolean).length / statusHistory.length) * 100) : null
  const minLat = latencyHistory && latencyHistory.length > 0
    ? Math.min(...latencyHistory) : null
  const maxLat = latencyHistory && latencyHistory.length > 0
    ? Math.max(...latencyHistory) : null
  const avgLat = latencyHistory && latencyHistory.length > 0
    ? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <StatusBadge status={item.status} />
        <span className="text-sm text-gray-500">{item.status === 'up' ? 'Healthy' : item.status === 'down' ? 'Down' : 'Degraded'}</span>
        {uptimePct !== null && (
          <span className="ml-auto text-xs font-medium text-gray-400">
            {uptimePct}% uptime
          </span>
        )}
      </div>
      {latencyHistory && latencyHistory.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>min <strong className="text-gray-300">{minLat}ms</strong></span>
          <span>avg <strong className="text-gray-300">{avgLat}ms</strong></span>
          <span>max <strong className="text-gray-300">{maxLat}ms</strong></span>
          <span className="ml-auto">{latencyHistory.length}/30 polls</span>
        </div>
      )}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4 space-y-1">
        <DetailRow label="URL" value={item.url} mono href={item.url} />
        <DetailRow label="Type" value={item.type} />
        <DetailRow label="Status Code" value={item.status_code} />
        <DetailRow label="Latency" value={item.latency} />
        <DetailRow label="Resolved IP" value={item.resolved_ip} mono />
        {formatBytes(item.response_size) && <DetailRow label="Response Size" value={formatBytes(item.response_size)} />}
        {formatTime(item.last_checked) && <DetailRow label="Last Checked" value={formatTime(item.last_checked)} />}
        {item.error && <DetailRow label="Error" value={item.error} />}
      </div>
      {latencyHistory && <LatencySparkline history={latencyHistory} />}
    </div>
  )
}

function ContainerDetail({ item }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/docker/${item.id}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [item.id])

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
        ))}
      </div>
    )
  }

  const d = detail || item

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <StatusBadge status={d.state || item.state} />
        <span className="text-sm text-gray-500">{d.status || item.status}</span>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4 space-y-1">
        <DetailRow label="ID" value={d.id} mono />
        <DetailRow label="Image" value={d.image} mono />
        {d.command && <DetailRow label="Command" value={d.command} mono />}
        {d.created && <DetailRow label="Created" value={d.created} />}
        {d.uptime && <DetailRow label="Uptime" value={d.uptime} />}
        {d.ports && <DetailRow label="Ports" value={d.ports} mono />}
        {d.pid > 0 && <DetailRow label="PID" value={d.pid} />}
        {d.network && <DetailRow label="Network" value={d.network} />}
        {d.ip && <DetailRow label="IP Address" value={d.ip} mono />}
      </div>

      {d.stats && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Performance</h3>
          <Bar
            label="CPU"
            value={d.stats.cpu_percent}
            total={100}
            valueLabel={`${d.stats.cpu_percent}%`}
            color="emerald"
          />
          <Bar
            label="Memory"
            value={d.stats.memory_usage_mb}
            total={d.stats.memory_limit_mb}
            valueLabel={`${d.stats.memory_usage_mb} MB / ${d.stats.memory_limit_mb} MB`}
            color="blue"
          />
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Network</span>
            <span className="font-mono text-gray-900 dark:text-white">
              {formatSpeed(d.stats.network_rx_speed)} / {formatSpeed(d.stats.network_tx_speed)}
            </span>
          </div>
        </div>
      )}

      {d.mounts && d.mounts.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-2">Mounts</h4>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-3 space-y-2">
            {d.mounts.map((m, i) => (
              <p key={i} className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">{m}</p>
            ))}
          </div>
        </div>
      )}

      {d.env && Object.keys(d.env).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-2">Environment</h4>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-3 max-h-48 overflow-y-auto space-y-1">
            {Object.entries(d.env).map(([k, v]) => (
              <p key={k} className="text-xs font-mono text-gray-700 dark:text-gray-400 break-all">
                <span className="text-emerald-600 dark:text-emerald-400">{k}</span>=<span className="text-gray-400 dark:text-gray-500">{v}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AddServiceModal({ onClose, onAdded }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState('http')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, type }),
      })
      if (!res.ok) {
        let errMsg = 'Failed to add service'
        try {
          const data = await res.json()
          errMsg = data.error || errMsg
        } catch (_) {
          errMsg = `Failed to add service (${res.status})`
        }
        throw new Error(errMsg)
      }
      onAdded()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Service</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="My Service"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL / Address</label>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} required placeholder="https://example.com"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="http">HTTP / HTTPS</option>
              <option value="tcp">TCP</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={adding}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors">
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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
  const latencyHistoryRef = useRef({})
  const statusHistoryRef = useRef({})

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

  const fetchAll = useCallback(async () => {
    try {
      const [srv, svc, dock, sys] = await Promise.all([
        fetch('/api/servers').then(r => r.json()),
        fetch('/api/services').then(r => r.json()),
        fetch('/api/docker').then(r => r.json()),
        fetch('/api/system').then(r => r.json()),
      ])
      setServers(Array.isArray(srv) ? srv : [])
      setServices(Array.isArray(svc) ? svc : [])
      setContainers(Array.isArray(dock) ? dock : [])
      setSystemStats(sys)

      const newHistory = { ...latencyHistoryRef.current }
      const newStatusHistory = { ...statusHistoryRef.current }
      for (const item of [...srv, ...svc]) {
        if (!newHistory[item.name]) newHistory[item.name] = []
        if (!newStatusHistory[item.name]) newStatusHistory[item.name] = []
        const val = parseInt(item.latency, 10)
        if (!isNaN(val)) {
          newHistory[item.name].push(val)
        }
        if (newHistory[item.name].length > 30) {
          newHistory[item.name].shift()
        }
        newStatusHistory[item.name].push(item.status === 'up')
        if (newStatusHistory[item.name].length > 30) {
          newStatusHistory[item.name].shift()
        }
      }
      latencyHistoryRef.current = newHistory
      statusHistoryRef.current = newStatusHistory

      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 5000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const openServer = (s) => setPanel({ type: 'server', item: s })
  const openService = (s) => setPanel({ type: 'service', item: s })
  const openContainer = (c) => setPanel({ type: 'container', item: c })
  const openSystem = () => setPanel({ type: 'system', item: systemStats })

  const handleDeleteService = async (name) => {
    try {
      await fetch(`/api/services/${encodeURIComponent(name)}`, { method: 'DELETE' })
      fetchAll()
    } catch (e) {
      // ignore
    }
  }

  const cpuPct = systemStats?.cpu_usage_percent ?? 0
  const systemAccent = cpuPct < 50
    ? 'text-emerald-600 dark:text-emerald-400'
    : cpuPct < 70
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-rose-600 dark:text-rose-400'

  const upCount = servers.filter(s => s.alive).length
  const servicesUp = services.filter(s => s.status === 'up').length
  const runningContainers = containers.filter(c => c.state === 'running').length

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
        </div>
        {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HomeLab Monitor</h1>
          <p className="mt-1 text-sm text-gray-500">Real-time status of your infrastructure</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-2 text-gray-500 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-700 dark:hover:text-white active:scale-95"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button onClick={fetchAll} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-900/80 active:scale-95">
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Servers" value={`${upCount}/${servers.length}`} accent="text-emerald-600 dark:text-emerald-400" onClick={() => scrollToSection('servers-section')} subtitle={servers.length === 0 ? 'none configured' : ''} />
        <StatCard title="Services" value={`${servicesUp}/${services.length}`} accent="text-blue-600 dark:text-blue-400" onClick={() => scrollToSection('services-section')} subtitle={services.length === 0 ? 'none configured' : ''} />
        <StatCard title="Containers" value={`${runningContainers}/${containers.length}`} accent="text-purple-600 dark:text-purple-400" onClick={() => scrollToSection('containers-section')} subtitle={containers.length === 0 ? 'no docker' : ''} />
        <StatCard
          title="System"
          value={systemStats ? `${systemStats.cpu_usage_percent}%` : '-'}
          accent={systemAccent}
          onClick={openSystem}
          subtitle={systemStats ? `${systemStats.memory_used_percent}% RAM · ${systemStats.disk_used_percent}% disk` : ''}
        />
      </div>

      {servers.length > 0 && (
        <section id="servers-section" className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Servers</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((s, i) => <ServerCard key={i} server={s} onClick={() => openServer(s)} />)}
          </div>
        </section>
      )}

      {services.length > 0 && (
        <section id="services-section" className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Services</h2>
            <button onClick={() => setShowAddService(true)}
              className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white">
              + Add Service
            </button>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 backdrop-blur-sm overflow-hidden transition-colors">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="py-3 pl-4 pr-2 w-1/2">Service</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2">Code</th>
                  <th className="py-3 px-2">Latency</th>
                  <th className="py-3 pr-4 pl-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {services.map((s, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                    <td className="py-0 pl-4 pr-2">
                      <button onClick={() => openService(s)} className="group flex items-center w-full py-3 text-left">
                        <span className={`w-1.5 h-1.5 rounded-full mr-3 shrink-0 ${s.status === 'up' ? 'bg-emerald-500 dark:bg-emerald-400' : s.status === 'down' ? 'bg-red-500 dark:bg-red-400' : 'bg-amber-500 dark:bg-amber-400'}`}
                          style={{ boxShadow: s.status === 'up' ? '0 0 6px rgba(52,211,153,0.6)' : s.status === 'down' ? '0 0 6px rgba(248,113,113,0.6)' : '0 0 6px rgba(251,191,36,0.6)' }}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">{s.name}</p>
                          <p className="text-xs text-gray-500 truncate">{s.url}</p>
                        </div>
                      </button>
                    </td>
                    <td className="py-3 px-2"><StatusBadge status={s.status} /></td>
                    <td className="py-3 px-2 text-sm text-gray-500">{s.status_code > 0 && s.status_code}</td>
                    <td className="py-3 px-2 text-sm text-gray-500">{s.latency}</td>
                    <td className="py-3 pr-4 pl-2">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteService(s.name) }}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="Delete service">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {containers.length > 0 && (
        <section id="containers-section" className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Docker Containers</h2>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 backdrop-blur-sm overflow-hidden transition-colors">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="py-3 pl-4 pr-2 w-1/2">Container</th>
                  <th className="py-3 px-2">State</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 pl-2 pr-4">Ports</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                    <td className="py-0 pl-4 pr-2">
                      <button onClick={() => openContainer(c)} className="group flex items-center w-full py-3 text-left">
                        <span className={`w-1.5 h-1.5 rounded-full mr-3 shrink-0 ${c.state === 'running' ? 'bg-emerald-500 dark:bg-emerald-400' : c.state === 'paused' ? 'bg-amber-500 dark:bg-amber-400' : 'bg-gray-400 dark:bg-gray-500'}`} />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">{c.name || c.id}</p>
                          <p className="text-xs text-gray-500 truncate">{c.image}</p>
                        </div>
                      </button>
                    </td>
                    <td className="py-3 px-2"><StatusBadge status={c.state} /></td>
                    <td className="py-3 px-2 text-sm text-gray-500">{c.status}</td>
                    <td className="py-3 pl-2 pr-4 text-xs text-gray-500">{c.ports || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {servers.length === 0 && services.length === 0 && containers.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-800 p-12 text-center">
          <p className="text-gray-500">No servers, services, or Docker containers found.</p>
          <p className="mt-1 text-sm text-gray-400">Configure your <code className="rounded bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 text-xs text-gray-600 dark:text-gray-400">config.yaml</code> and mount the Docker socket.</p>
        </div>
      )}

      {showAddService && <AddServiceModal onClose={() => setShowAddService(false)} onAdded={fetchAll} />}
      <DetailPanel
        item={panel?.item}
        type={panel?.type}
        onClose={() => setPanel(null)}
        latencyHistory={latencyHistoryRef.current[panel?.item?.name]}
        statusHistory={statusHistoryRef.current[panel?.item?.name]}
      />
    </div>
  )
}
// ssh-sign-v2
// Dashboard.jsx — network speed fix (signed)
