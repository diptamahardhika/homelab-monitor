import { useState, useRef } from 'react'

const SPARKLINE_STROKES = {
  emerald: 'stroke-emerald-500',
  amber: 'stroke-amber-500',
  rose: 'stroke-rose-500',
  blue: 'stroke-blue-500',
  purple: 'stroke-purple-500',
}

const SPARKLINE_FILLS = {
  emerald: 'rgb(52,211,153)',
  amber: 'rgb(251,191,36)',
  rose: 'rgb(248,113,113)',
  blue: 'rgb(59,130,246)',
  purple: 'rgb(168,85,247)',
}

export function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

export function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}

export function GearIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

export function LockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

export function StatusBadge({ status }) {
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

export function UptimeBadge({ stats }) {
  if (!stats || stats.samples === 0) return <span className="text-xs text-gray-400">—</span>
  const pct = stats.uptime_percent
  const color = pct >= 99
    ? 'text-emerald-600 dark:text-emerald-400'
    : pct >= 95
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-rose-600 dark:text-rose-400'
  return (
    <span className={`text-xs font-medium whitespace-nowrap ${color}`} title={`30-day uptime · ${stats.up_samples}/${stats.samples} samples up`}>
      {pct.toFixed(1)}%
      <span className="ml-0.5 text-[10px] text-gray-400 dark:text-gray-500">· 30d</span>
    </span>
  )
}

export function Dot({ alive }) {
  return (
    <span
      className={`relative flex h-2.5 w-2.5 shrink-0 ${alive ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-red-500 dark:bg-red-400'}`}
      style={{ borderRadius: '50%', boxShadow: alive ? '0 0 8px rgba(52,211,153,0.5)' : '0 0 8px rgba(248,113,113,0.5)' }}
    />
  )
}

export function LatencySparkline({ history, height = 32, width = 160 }) {
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

export function Trend({ history }) {
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

export function CopyButton({ text }) {
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

export function PortLinks({ ports }) {
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

export function UptimeCard({ stats }) {
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

export function StatCard({ title, value, subtitle, accent, onClick, children }) {
  return (
    <button onClick={onClick} className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-5 backdrop-blur-sm transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm text-left w-full min-w-0">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className={`mt-1 text-3xl font-bold ${accent || 'text-gray-900 dark:text-white'} transition-colors`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
      {children}
    </button>
  )
}

// SparklineChart renders a single trend line with a soft area fill.
export function SparklineChart({ values, color = 'emerald', height = 48, width = 200, domain }) {
  if (!values || values.length < 2) return null
  const nums = values.map(v => (typeof v === 'number' ? v : parseFloat(v) || 0))
  const lo = domain ? domain[0] : Math.min(...nums)
  const hi = domain ? domain[1] : Math.max(...nums)
  const range = hi - lo || 1
  const clamp = v => Math.min(hi, Math.max(lo, v))
  const points = nums.map((v, i) => {
    const x = (i / (nums.length - 1)) * width
    const y = height - ((clamp(v) - lo) / range) * (height - 8) - 4
    return `${x},${y}`
  }).join(' ')
  const gradId = `spark-${color}-${height}-${nums.length}`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SPARKLINE_FILLS[color] || 'rgb(52,211,153)'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={SPARKLINE_FILLS[color] || 'rgb(52,211,153)'} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradId})`} points={`0,${height} ${points} ${width},${height}`} />
      <polyline fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={SPARKLINE_STROKES[color] || 'stroke-emerald-500'} points={points} />
    </svg>
  )
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-800 p-8 text-center">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {action}
    </div>
  )
}

export function SortIcon({ active, dir }) {
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

export function SortHeader({ label, sortKey, sort, onSort, className }) {
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

export function FilterChips({ options, value, onChange }) {
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

export function SearchInput({ value, onChange, placeholder }) {
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

export function Bar({ value, label, valueLabel, color, total }) {
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

export function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s'
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(1)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`
}

export function formatTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function formatRelative(ts, now) {
  const diff = Math.max(0, Math.floor((now - ts) / 1000))
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function formatBytes(n) {
  if (!n || n <= 0) return null
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function DetailRow({ label, value, mono, href, copyable }) {
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

export const statusRank = (status) => status === 'down' ? 0 : status === 'degraded' ? 1 : 2

export const containerRank = (state) => {
  const ranks = { running: 0, restarting: 1, paused: 2, created: 3, exited: 4, dead: 5 }
  return ranks[state] ?? 6
}

export function filterAndSort(items, search, sort, nameFn, rankFn, latencyFn, stateFn, statusTextFn, pinFirst) {
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

export function toggleSort(setter, key) {
  setter(prev => prev.key === key
    ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: 'asc' })
}