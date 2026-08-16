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

function Trend({ history }) {
  if (!history || history.length < 2) return null
  const last = history[history.length - 1]
  const prev = history[history.length - 2]
  if (last === prev) return <span className="text-gray-400" title="No change">→</span>
  const worse = last > prev
  return (
    <span className={worse ? 'text-red-500' : 'text-emerald-500'} title={worse ? 'Latency increased' : 'Latency decreased'}>
      {worse ? '↑' : '↓'}
    </span>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (_) {
      // clipboard unavailable; ignore
    }
  }

  return (
    <button
      onClick={copy}
      className={`p-1 rounded transition-colors ${copied ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" />
        </svg>
      )}
    </button>
  )
}

function UptimeCard({ stats }) {
  if (!stats) return null
  const pct = isNaN(stats.uptime_percent) ? 0 : stats.uptime_percent
  const ring = pct >= 99 ? 'emerald' : pct >= 95 ? 'amber' : 'rose'
  const color = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
  }[ring]
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4 space-y-2">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Uptime (rolling window)</h3>
      <div className="flex items-end justify-between">
        <span className={`text-2xl font-bold ${color}`}>{pct.toFixed(1)}%</span>
        <span className="text-xs text-gray-400">{stats.up_samples}/{stats.samples} up</span>
      </div>
      {stats.last_down && (
        <p className="text-xs text-gray-500">Last down: {stats.last_down}</p>
      )}
      {!stats.last_down && (
        <p className="text-xs text-gray-500">No outages recorded in window</p>
      )}
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

function EmptyState({ title, hint, action }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-800 p-8 text-center">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {action}
    </div>
  )
}

function SortIcon({ active, dir }) {
  const color = active ? 'text-emerald-500' : 'text-gray-400'
  if (active && dir === 'asc') {
    return (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12l7-7 7 7" />
      </svg>
    )
  }
  if (active && dir === 'desc') {
    return (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7 7 7-7" />
      </svg>
    )
  }
  return (
    <svg className={`w-3 h-3 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6l4-4 4 4M8 18l4 4 4-4" />
    </svg>
  )
}

function SortHeader({ label, sortKey, sort, onSort, className }) {
  const active = sort.key === sortKey
  return (
    <th className={`py-3 px-2 ${className || ''}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider text-xs font-medium transition-colors ${
          active ? 'text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
        title={`Sort by ${label}${active ? ` (${sort.dir === 'asc' ? 'ascending' : 'descending'})` : ''}`}
      >
        {label}
        <SortIcon active={active} dir={sort.dir} />
      </button>
    </th>
  )
}

function ServerCard({ server, onClick, latencyHistory }) {
  return (
    <button onClick={onClick} className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-4 backdrop-blur-sm transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm text-left w-full">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{server.name}</h3>
          <p className="mt-0.5 text-sm text-gray-500 truncate">{server.host}{server.port ? `:${server.port}` : ''}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            {server.latency || '—'}
            <Trend history={latencyHistory} />
          </span>
          <Dot alive={server.alive} />
        </div>
      </div>
      {server.error && <p className="mt-2 text-xs text-red-500 dark:text-red-400 truncate">{server.error}</p>}
    </button>
  )
}

function DetailPanel({ item, type, onClose, onEdit, latencyHistory, historyStats }) {
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
          <div className="flex items-center gap-2 shrink-0">
            {type === 'service' && onEdit && (
              <button onClick={onEdit}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 transition-colors hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit
              </button>
            )}
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {item && (
          <div className="p-6 space-y-6">
            {type === 'server' && <ServerDetail item={item} latencyHistory={latencyHistory} historyStats={historyStats} />}
            {type === 'service' && <ServiceDetail item={item} latencyHistory={latencyHistory} historyStats={historyStats} />}
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

function DetailRow({ label, value, mono, href, copyable }) {
  if (value === undefined || value === null || value === '') return null
  const content = href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 dark:hover:text-emerald-400 underline underline-offset-2 transition-colors">{value}</a>
    : value
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-gray-100 dark:border-gray-800/50 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="flex items-start gap-1.5 max-w-[60%]">
        <span className={`text-sm text-gray-900 dark:text-white text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>{content}</span>
        {copyable && <CopyButton text={String(value)} />}
      </span>
    </div>
  )
}

function ServerDetail({ item, latencyHistory, historyStats }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Dot alive={item.alive} />
        <span className="text-sm text-gray-500">{item.alive ? 'Reachable' : 'Unreachable'}</span>
      </div>
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4 space-y-1">
        <DetailRow label="Host" value={`${item.host}${item.port ? `:${item.port}` : ''}`} mono copyable />
        <DetailRow label="Type" value={item.type} />
        <DetailRow label="Latency" value={item.latency || '—'} />
        {item.error && <DetailRow label="Error" value={item.error} />}
      </div>
      {historyStats && <UptimeCard stats={historyStats} />}
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

function formatRelative(ts, now) {
  const diff = Math.max(0, Math.floor((now - ts) / 1000))
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function formatBytes(n) {
  if (!n || n <= 0) return null
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function ServiceDetail({ item, latencyHistory, historyStats }) {
  const uptimePct = historyStats && !isNaN(historyStats.uptime_percent)
    ? Math.round(historyStats.uptime_percent) : null
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
        <DetailRow label="URL" value={item.url} mono href={item.url} copyable />
        <DetailRow label="Type" value={item.type} />
        <DetailRow label="Status Code" value={item.status_code} />
        <DetailRow label="Latency" value={item.latency || '—'} />
        <DetailRow label="Resolved IP" value={item.resolved_ip} mono copyable />
        {formatBytes(item.response_size) && <DetailRow label="Response Size" value={formatBytes(item.response_size)} />}
        {formatTime(item.last_checked) && <DetailRow label="Last Checked" value={formatTime(item.last_checked)} />}
        {item.error && <DetailRow label="Error" value={item.error} />}
      </div>
      {historyStats && <UptimeCard stats={historyStats} />}
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
        <DetailRow label="ID" value={d.id} mono copyable />
        <DetailRow label="Image" value={d.image} mono copyable />
        {d.command && <DetailRow label="Command" value={d.command} mono />}
        {d.created && <DetailRow label="Created" value={d.created} />}
        {d.uptime && <DetailRow label="Uptime" value={d.uptime} />}
        {d.ports && <DetailRow label="Ports" value={d.ports} mono copyable />}
        {d.pid > 0 && <DetailRow label="PID" value={d.pid} />}
        {d.network && <DetailRow label="Network" value={d.network} />}
        {d.ip && <DetailRow label="IP Address" value={d.ip} mono copyable />}
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

function AddServiceModal({ initial, onClose, onAdded, onError }) {
  const isEdit = Boolean(initial)
  const [name, setName] = useState(initial?.name || '')
  const [url, setUrl] = useState(initial?.url || '')
  const [type, setType] = useState(initial?.type || 'http')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAdding(true)
    setError(null)
    try {
      const res = await fetch(isEdit ? `/api/services/${encodeURIComponent(initial.name)}` : '/api/services', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, type }),
      })
      if (!res.ok) {
        let errMsg = isEdit ? 'Failed to update service' : 'Failed to add service'
        try {
          const data = await res.json()
          errMsg = data.error || errMsg
        } catch (_) {
          errMsg = `${isEdit ? 'Failed to update service' : 'Failed to add service'} (${res.status})`
        }
        throw new Error(errMsg)
      }
      onAdded()
      onClose()
    } catch (err) {
      setError(err.message)
      if (onError) onError(err.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{isEdit ? 'Edit Service' : 'Add Service'}</h3>
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
              {adding ? 'Saving...' : isEdit ? 'Save' : 'Add'}
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
  const [editingService, setEditingService] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [servicesSearch, setServicesSearch] = useState('')
  const [containersSearch, setContainersSearch] = useState('')
  const [servicesSort, setServicesSort] = useState({ key: 'name', dir: 'asc' })
  const [containersSort, setContainersSort] = useState({ key: 'status', dir: 'asc' })
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

  const fetchAll = useCallback(async () => {
    try {
      const [overview, hist] = await Promise.all([
        fetch('/api/overview').then(r => r.json()),
        fetch('/api/history').then(r => r.json()).catch(() => ({})),
      ])
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
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let interval = null

    const startPolling = () => {
      if (!interval) interval = setInterval(fetchAll, 5000)
    }
    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }
    const onVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        fetchAll()
        startPolling()
      }
    }

    fetchAll()
    startPolling()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stopPolling()
    }
  }, [fetchAll])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const openServer = (s) => setPanel({ type: 'server', item: s })
  const openService = (s) => setPanel({ type: 'service', item: s })
  const openContainer = (c) => setPanel({ type: 'container', item: c })
  const openSystem = () => setPanel({ type: 'system', item: systemStats })

  const confirmDelete = async (name) => {
    setConfirmingDelete(null)
    try {
      const res = await fetch(`/api/services/${encodeURIComponent(name)}`, { method: 'DELETE' })
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

  const openEditService = () => {
    const s = panel?.item
    if (!s) return
    setPanel(null)
    setEditingService({ name: s.name, url: s.url, type: s.type })
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

  const statusRank = (status) => status === 'down' ? 0 : status === 'degraded' ? 1 : 2
  const containerRank = (state) => {
    const ranks = { running: 0, restarting: 1, paused: 2, created: 3, exited: 4, dead: 5 }
    return ranks[state] ?? 6
  }

  const filterAndSort = (items, search, sort, nameFn, rankFn, latencyFn, stateFn, statusTextFn, pinFirst) => {
    const q = search.trim().toLowerCase()
    const filtered = q ? items.filter(it => (nameFn(it) || '').toLowerCase().includes(q)) : items
    const sorted = [...filtered]
    const dir = sort.dir === 'desc' ? -1 : 1
    const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0
    if (sort.key === 'status') {
      sorted.sort((a, b) => {
        if (pinFirst) {
          const aPinned = rankFn(a) === 0
          const bPinned = rankFn(b) === 0
          if (aPinned !== bPinned) return aPinned ? -1 : 1
        }
        return (rankFn(a) - rankFn(b)) * dir || String(nameFn(a)).localeCompare(String(nameFn(b)))
      })
    } else if (sort.key === 'state') {
      sorted.sort((a, b) => String(stateFn(a) || '').localeCompare(String(stateFn(b) || '')) * dir)
    } else if (sort.key === 'statustext') {
      sorted.sort((a, b) => String(statusTextFn(a) || '').localeCompare(String(statusTextFn(b) || '')) * dir)
    } else if (sort.key === 'latency') {
      sorted.sort((a, b) => cmp(latencyFn(a) || Infinity, latencyFn(b) || Infinity) * dir || String(nameFn(a)).localeCompare(String(nameFn(b))))
    } else {
      sorted.sort((a, b) => String(nameFn(a)).localeCompare(String(nameFn(b))) * dir)
    }
    return sorted
  }

  const toggleSort = (setter, key) => {
    setter(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })
  }

  const visibleServices = filterAndSort(services, servicesSearch, servicesSort, s => s.name, statusRank, s => parseInt(s.latency, 10))
  const visibleContainers = filterAndSort(containers, containersSearch, containersSort, c => c.name || c.id, containerRank, c => null, c => c.state, c => c.status, true)

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
          <div
            className="flex items-center gap-1.5 text-xs text-gray-400"
            title={lastUpdated ? `Last updated at ${new Date(lastUpdated).toLocaleTimeString()}` : 'Waiting for first update'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${lastUpdated && now - lastUpdated < 10000 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            <span>{lastUpdated ? `Updated ${formatRelative(lastUpdated, now)}` : 'Waiting for first update'}</span>
          </div>
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

      <section id="servers-section" className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Servers <span className="text-sm font-normal text-gray-400">({servers.length})</span>
        </h2>
        {servers.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((s, i) => <ServerCard key={i} server={s} latencyHistory={latencyHistoryRef.current[s.name]} onClick={() => openServer(s)} />)}
          </div>
        ) : (
          <EmptyState
            title="No servers configured"
            hint="Add servers to config.yaml, or edit them via the Configuration (gear) button in the toolbar."
          />
        )}
      </section>

      <section id="services-section" className="mb-8">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Services <span className="text-sm font-normal text-gray-400">({services.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={servicesSearch}
              onChange={e => setServicesSearch(e.target.value)}
              placeholder="Search services..."
              className="w-44 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
            />
            <button onClick={() => setShowAddService(true)}
              className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white">
              + Add Service
            </button>
          </div>
        </div>
        {services.length > 0 ? (
          visibleServices.length === 0 ? (
            <EmptyState title="No services match your search" hint="Try a different search term." />
          ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 backdrop-blur-sm overflow-hidden transition-colors">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortHeader label="Service" sortKey="name" sort={servicesSort} onSort={k => toggleSort(setServicesSort, k)} className="py-3 pl-4 pr-2 w-1/2" />
                  <SortHeader label="Status" sortKey="status" sort={servicesSort} onSort={k => toggleSort(setServicesSort, k)} />
                  <th className="py-3 px-2">Code</th>
                  <SortHeader label="Latency" sortKey="latency" sort={servicesSort} onSort={k => toggleSort(setServicesSort, k)} />
                  <th className="py-3 pr-4 pl-2 w-28"></th>
                </tr>
              </thead>
              <tbody>
                {visibleServices.map((s, i) => (
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
                    <td className="py-3 px-2 text-sm text-gray-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {s.latency || '—'}
                        <Trend history={latencyHistoryRef.current[s.name]} />
                      </span>
                    </td>
                    <td className="py-3 pr-4 pl-2 w-28 whitespace-nowrap">
                      {confirmingDelete === s.name ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => confirmDelete(s.name)}
                            className="rounded bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600 transition-colors"
                            title="Confirm delete">
                            Yes
                          </button>
                          <button onClick={() => setConfirmingDelete(null)}
                            className="rounded border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            title="Cancel delete">
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <button onClick={() => setConfirmingDelete(s.name)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Delete service">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )
        ) : (
          <EmptyState
            title="No services being monitored"
            hint="Add your first service to start checking its health."
            action={
              <button onClick={() => setShowAddService(true)}
                className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors">
                + Add Service
              </button>
            }
          />
        )}
      </section>

      <section id="containers-section" className="mb-8">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Docker Containers <span className="text-sm font-normal text-gray-400">({containers.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={containersSearch}
              onChange={e => setContainersSearch(e.target.value)}
              placeholder="Search containers..."
              className="w-44 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
            />
          </div>
        </div>
        {containers.length > 0 ? (
          visibleContainers.length === 0 ? (
            <EmptyState title="No containers match your search" hint="Try a different search term." />
          ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 backdrop-blur-sm overflow-hidden transition-colors">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortHeader label="Container" sortKey="name" sort={containersSort} onSort={k => toggleSort(setContainersSort, k)} className="py-3 pl-4 pr-2 w-1/2" />
                  <SortHeader label="State" sortKey="status" sort={containersSort} onSort={k => toggleSort(setContainersSort, k)} />
                  <SortHeader label="Status" sortKey="statustext" sort={containersSort} onSort={k => toggleSort(setContainersSort, k)} />
                  <th className="py-3 pl-2 pr-4">Ports</th>
                </tr>
              </thead>
              <tbody>
                {visibleContainers.map((c, i) => (
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
          )
        ) : (
          <EmptyState
            title="No containers detected"
            hint="Mount the Docker socket (/var/run/docker.sock) to monitor your containers."
          />
        )}
      </section>

      {showAddService && <AddServiceModal onClose={() => setShowAddService(false)} onAdded={() => { fetchAll(); showToast('Service added') }} onError={msg => showToast(msg, 'error')} />}
      {editingService && <AddServiceModal initial={editingService} onClose={() => setEditingService(null)} onAdded={() => { fetchAll(); showToast('Service updated') }} onError={msg => showToast(msg, 'error')} />}
      <DetailPanel
        item={panel?.item}
        type={panel?.type}
        onClose={() => setPanel(null)}
        onEdit={openEditService}
        latencyHistory={latencyHistoryRef.current[panel?.item?.name]}
        historyStats={historyStatsRef.current[`${panel?.type}:${panel?.item?.name}`]}
      />

      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-xl transition-opacity duration-200 ${
            toast.type === 'error'
              ? 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-400'
              : 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400'
          }`}
          role="status"
        >
          {toast.type === 'error' ? (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
          <span className="min-w-0">{toast.message}</span>
        </div>
      )}
    </div>
  )
}
// ssh-sign-v2
// Dashboard.jsx — network speed fix (signed)
