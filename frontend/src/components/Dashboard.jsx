import { useState, useEffect, useCallback, useRef } from 'react'
import DependencyGraph from './DependencyGraph'

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

function GearIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

function UptimeBadge({ stats }) {
  if (!stats || stats.samples === 0) return <span className="text-xs text-gray-400">—</span>
  const pct = stats.uptime_percent
  const color = pct >= 99
    ? 'text-emerald-600 dark:text-emerald-400'
    : pct >= 95
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-rose-600 dark:text-rose-400'
  return (
    <span className={`text-xs font-medium whitespace-nowrap ${color}`} title={`${stats.up_samples}/${stats.samples} up`}>
      {pct.toFixed(1)}%
    </span>
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
    const copied = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        copied()
        return
      }
      throw new Error('clipboard API unavailable')
    } catch (_) {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        copied()
      } finally {
        document.body.removeChild(ta)
      }
    }
  }

  return (
    <button
      onClick={copy}
      className={`p-1 rounded transition-colors ${copied ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
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

function PortLinks({ ports }) {
  if (!ports) return <span className="text-gray-400">-</span>
  const host = window.location.hostname
  const items = ports.split(',').map(p => p.trim()).filter(Boolean)
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((p, i) => {
        const m = p.match(/^(\d+):(\d+)\/(tcp|udp)$/)
        if (!m || m[3] !== 'tcp') {
          return <span key={i} className="text-gray-500">{p}</span>
        }
        const hostPort = m[1]
        return (
          <span key={i} className="inline-flex items-center rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 px-1.5 py-0.5 text-[11px] text-gray-500">
            {hostPort}:
            <a
              href={`http://${host}:${hostPort}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open http://${host}:${hostPort}`}
              className="ml-0.5 font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >http</a>
            <span className="mx-0.5 text-gray-300 dark:text-gray-600">/</span>
            <a
              href={`https://${host}:${hostPort}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open https://${host}:${hostPort}`}
              className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >https</a>
          </span>
        )
      })}
    </div>
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
    <button onClick={onClick} className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-5 backdrop-blur-sm transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm text-left w-full min-w-0">
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

function FilterChips({ options, value, onChange }) {
  return (
    <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-0.5 gap-0.5" role="group" aria-label="Filter by status">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
            value === o.value
              ? 'bg-emerald-600 text-white'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className={`ml-1 ${value === o.value ? 'text-emerald-100' : 'text-gray-400'}`}>{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

function SearchInput({ value, onChange, placeholder }) {
  const ref = useRef(null)
  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') { onChange('') } }}
        placeholder={placeholder}
        className="w-44 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 pl-3 pr-8 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); ref.current?.focus() }}
          aria-label="Clear search"
          title="Clear search"
          className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

function ServerCard({ server, onClick, latencyHistory, onEdit, onDelete, onConfirmDelete, confirmingDelete }) {
  const actions = onEdit || onDelete ? (
    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-1.5">
      {confirmingDelete === server.name ? (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onConfirmDelete(server.name) }}
            className="rounded bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600 transition-colors"
            aria-label={`Confirm delete ${server.name}`}
          >
            Delete
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(null) }}
            className="rounded border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            aria-label="Cancel delete"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(server) }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={`Edit ${server.name}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(server.name) }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            aria-label={`Delete ${server.name}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </>
      )}
    </div>
  ) : null

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="group cursor-pointer rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-4 backdrop-blur-sm transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm text-left w-full min-w-0"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{server.name}</h3>
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
      {actions}
    </div>
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

  useEffect(() => {
    if (!item) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [item, handleClose])

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

function ServerModal({ initial, onClose, onAdded, onError }) {
  const isEdit = Boolean(initial)
  const [name, setName] = useState(initial?.name || '')
  const [host, setHost] = useState(initial?.host || '')
  const [port, setPort] = useState(initial?.port ? String(initial.port) : '')
  const [type, setType] = useState(initial?.type || 'tcp')
  const [gateway, setGateway] = useState(initial?.gateway || '')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAdding(true)
    setError(null)
    try {
      const res = await fetch(isEdit ? `/api/servers/${encodeURIComponent(initial.name)}` : '/api/servers', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, host, port: parseInt(port, 10) || 0, type, gateway }),
      })
      if (!res.ok) {
        let errMsg = isEdit ? 'Failed to update server' : 'Failed to add server'
        try {
          const data = await res.json()
          errMsg = data.error || errMsg
        } catch (_) {
          errMsg = `${isEdit ? 'Failed to update server' : 'Failed to add server'} (${res.status})`
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{isEdit ? 'Edit Server' : 'Add Server'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="My Server"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Host</label>
            <input type="text" value={host} onChange={e => setHost(e.target.value)} required placeholder="192.168.1.100"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
            <input type="number" min="1" max="65535" value={port} onChange={e => setPort(e.target.value)} required placeholder="22"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="tcp">TCP</option>
              <option value="http">HTTP</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gateway
              <span className="ml-1 text-xs font-normal text-gray-400">(optional — "docker" uses the bridge gateway)</span>
            </label>
            <input type="text" value={gateway} onChange={e => setGateway(e.target.value)} placeholder=""
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
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
  const [showAddServer, setShowAddServer] = useState(false)
  const [editingServer, setEditingServer] = useState(null)
  const [confirmingServerDelete, setConfirmingServerDelete] = useState(null)
  const [version, setVersion] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [servicesSearch, setServicesSearch] = useState('')
  const [containersSearch, setContainersSearch] = useState('')
  const [servicesFilter, setServicesFilter] = useState('all')
  const [containersFilter, setContainersFilter] = useState('all')
  const [servicesSort, setServicesSort] = useState({ key: 'name', dir: 'asc' })
  const [containersSort, setContainersSort] = useState({ key: 'status', dir: 'asc' })
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const [showConfigMenu, setShowConfigMenu] = useState(false)
  const fileInputRef = useRef(null)
  const configMenuRef = useRef(null)
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
    fetch('/api/version')
      .then(r => r.json())
      .then(d => { if (d && d.version) setVersion(d.version) })
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

  const confirmServerDelete = async (name) => {
    setConfirmingServerDelete(null)
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(name)}`, { method: 'DELETE' })
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
    setConfirmingServerDelete(null)
    setEditingServer({ name: s.name, host: s.host, port: s.port, type: s.type, gateway: s.gateway || '' })
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
    setShowConfigMenu(false)
    try {
      const res = await fetch('/api/export')
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
    setShowConfigMenu(false)
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!parsed || !Array.isArray(parsed.servers) || !Array.isArray(parsed.services)) {
        throw new Error('Invalid config file: expected servers and services arrays')
      }
      const res = await fetch('/api/import', {
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

  useEffect(() => {
    const onClick = (e) => {
      if (configMenuRef.current && !configMenuRef.current.contains(e.target)) {
        setShowConfigMenu(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

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

  const filteredServices = servicesFilter === 'all' ? services : services.filter(s => s.status === servicesFilter)
  const filteredContainers = containersFilter === 'all' ? containers : containers.filter(c => c.state === containersFilter)
  const visibleServices = filterAndSort(filteredServices, servicesSearch, servicesSort, s => s.name, statusRank, s => parseInt(s.latency, 10))
  const visibleContainers = filterAndSort(filteredContainers, containersSearch, containersSort, c => c.name || c.id, containerRank, c => null, c => c.state, c => c.status, true)

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
      <header className="mb-8 flex flex-wrap items-center justify-between gap-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HomeLab Monitor</h1>
          <p className="mt-1 text-sm text-gray-500">Real-time status of your infrastructure</p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400"
            title={lastUpdated ? `Last updated at ${new Date(lastUpdated).toLocaleTimeString()}` : 'Waiting for first update'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${lastUpdated && now - lastUpdated < 10000 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            <span>{lastUpdated ? `Updated ${formatRelative(lastUpdated, now)}` : 'Waiting for first update'}</span>
          </div>
          <button
            onClick={toggleTheme}
            className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-2 text-gray-500 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-700 dark:hover:text-white active:scale-95"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <div className="relative" ref={configMenuRef}>
            <button
              onClick={() => setShowConfigMenu(v => !v)}
              className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-2 text-gray-500 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-700 dark:hover:text-white active:scale-95"
              title="Config: export or import"
              aria-label="Config: export or import"
              aria-expanded={showConfigMenu}
            >
              <GearIcon />
            </button>
            {showConfigMenu && (
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg py-1.5">
                <button
                  onClick={exportConfig}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Export config (JSON)
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Import config (JSON)
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    importConfig(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </div>
            )}
          </div>
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-900/80 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Refresh data"
          >
            {refreshing ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <StatusBanner servers={servers} services={services} containers={containers} />

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
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Servers <span className="text-sm font-normal text-gray-400">({servers.length})</span>
          </h2>
          <button onClick={() => setShowAddServer(true)}
            className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white">
            + Add Server
          </button>
        </div>
        {servers.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((s, i) => (
              <ServerCard
                key={i}
                server={s}
                latencyHistory={latencyHistoryRef.current[s.name]}
                onClick={() => openServer(s)}
                onEdit={openEditServer}
                onDelete={(name) => name ? setConfirmingServerDelete(name) : setConfirmingServerDelete(null)}
                onConfirmDelete={confirmServerDelete}
                confirmingDelete={confirmingServerDelete}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No servers configured"
            hint="Add a server to start monitoring its reachability."
            action={
              <button onClick={() => setShowAddServer(true)}
                className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors">
                + Add Server
              </button>
            }
          />
        )}
      </section>

      <section id="services-section" className="mb-8">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Services <span className="text-sm font-normal text-gray-400">({services.length})</span>
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChips
              options={[
                { value: 'all', label: 'All', count: services.length },
                { value: 'up', label: 'Up', count: services.filter(s => s.status === 'up').length },
                { value: 'down', label: 'Down', count: services.filter(s => s.status === 'down').length },
                { value: 'degraded', label: 'Degraded', count: services.filter(s => s.status === 'degraded').length },
              ]}
              value={servicesFilter}
              onChange={setServicesFilter}
            />
            <SearchInput
              value={servicesSearch}
              onChange={setServicesSearch}
              placeholder="Search services..."
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
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 backdrop-blur-sm overflow-x-auto transition-colors">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortHeader label="Service" sortKey="name" sort={servicesSort} onSort={k => toggleSort(setServicesSort, k)} className="py-3 pl-4 pr-2 w-1/2" />
                  <SortHeader label="Status" sortKey="status" sort={servicesSort} onSort={k => toggleSort(setServicesSort, k)} />
                  <th className="py-3 px-2">Code</th>
                  <SortHeader label="Latency" sortKey="latency" sort={servicesSort} onSort={k => toggleSort(setServicesSort, k)} />
                  <th className="py-3 px-2">Uptime</th>
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
                    <td className="py-3 px-2"><UptimeBadge stats={historyStatsRef.current[`service:${s.name}`]} /></td>
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
                            title="Delete service"
                            aria-label={`Delete ${s.name}`}>
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
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChips
              options={[
                { value: 'all', label: 'All', count: containers.length },
                { value: 'running', label: 'Running', count: containers.filter(c => c.state === 'running').length },
                { value: 'exited', label: 'Exited', count: containers.filter(c => c.state === 'exited').length },
                { value: 'paused', label: 'Paused', count: containers.filter(c => c.state === 'paused').length },
              ]}
              value={containersFilter}
              onChange={setContainersFilter}
            />
            <SearchInput
              value={containersSearch}
              onChange={setContainersSearch}
              placeholder="Search containers..."
            />
          </div>
        </div>
        {containers.length > 0 ? (
          visibleContainers.length === 0 ? (
            <EmptyState title="No containers match your search" hint="Try a different search term." />
          ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 backdrop-blur-sm overflow-x-auto transition-colors">
            <table className="w-full min-w-[640px]">
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
                    <td className="py-3 pl-2 pr-4 text-xs text-gray-500"><PortLinks ports={c.ports} /></td>
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

      <footer className="mt-10 pt-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400">
        <span>HomeLab Monitor</span>
        {version && <span className="font-mono">v{version}</span>}
      </footer>
    </div>
  )
}
