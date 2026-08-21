import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../api'
import { Dot, StatusBadge, UptimeCard, LatencySparkline, CopyButton, DetailRow, Bar, formatSpeed, formatBytes, formatTime, SparklineChart } from './ui'

function MetricChart({ label, values, times, color, live, format, usage, domain }) {
  let series = values
  let xs = times
  if (live != null && values.length) {
    series = [...values, live]
    xs = times ? [...times, Date.now()] : undefined
  }
  const readout = live != null ? format(live) : (values.length ? format(values[values.length - 1]) : '—')
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm font-mono text-gray-500">
          {readout}
          {usage && <span className="ml-1.5 text-xs text-gray-400">{usage}</span>}
        </span>
      </div>
      {series.length >= 2 ? (
        <SparklineChart values={series} times={xs} color={color} height={48} width={200} domain={domain} />
      ) : (
        <p className="text-xs text-gray-400">Collecting data…</p>
      )}
    </div>
  )
}

const TREND_RANGES = [
  { value: 'live', label: 'Live', hours: 5 / 60 },
  { value: 1, label: '1h', hours: 1 },
  { value: 6, label: '6h', hours: 6 },
  { value: 12, label: '12h', hours: 12 },
  { value: 24, label: '24h', hours: 24 },
]

function SystemDetail({ stats }) {
  const [series, setSeries] = useState([])
  // Live snapshots pushed over SSE, kept separately from the stored history
  // (which the backend samples only once per minute) so the trend lines move
  // in real time between stored points.
  const liveBufRef = useRef([])
  const [range, setRange] = useState(() => {
    try {
      const saved = localStorage.getItem('system-trend-range')
      if (saved === 'live') return 'live'
      const n = Number(saved)
      return [1, 6, 12, 24].includes(n) ? n : 24
    } catch { return 24 }
  })
  const rangeHours = TREND_RANGES.find(r => r.value === range)?.hours ?? 24

  const changeRange = (h) => {
    setRange(h)
    try { localStorage.setItem('system-trend-range', String(h)) } catch {}
  }

  useEffect(() => {
    let active = true
    const load = () => {
      apiFetch(`/api/system/history?hours=${range === 'live' ? 1 : range}`)
        .then(r => r.json())
        .then(d => {
          if (!active || !Array.isArray(d?.samples)) return
          setSeries(d.samples)
          // Drop buffered live points the fetch already covers (sample ts is
          // epoch seconds; buffer ts is milliseconds).
          const lastTs = d.samples.length ? d.samples[d.samples.length - 1].ts * 1000 : 0
          liveBufRef.current = liveBufRef.current.filter(p => p.ts > lastTs + 1000)
        })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 60000)
    return () => { active = false; clearInterval(id) }
  }, [range])

  useEffect(() => {
    if (!stats) return
    const buf = liveBufRef.current
    buf.push({
      ts: Date.now(),
      cpu: stats.cpu_usage_percent,
      mem: stats.memory_used_percent,
      disk: stats.disk_used_percent,
    })
    if (buf.length > 320) buf.shift()
  }, [stats])

  if (!stats) return null

  // Merge stored samples (epoch seconds) with the live buffer and keep only
  // what fits the selected window so the chart slides left as time advances.
  const merged = [
    ...series.map(s => ({ ts: s.ts * 1000, cpu: s.cpu, mem: s.memory_used_percent, disk: s.disk_used_percent })),
    ...liveBufRef.current,
  ]
  const windowMs = rangeHours * 3600 * 1000
  const newestTs = merged.length ? merged[merged.length - 1].ts : 0
  const pts = newestTs ? merged.filter(p => p.ts >= newestTs - windowMs) : []
  const cpuSeries = pts.map(p => p.cpu)
  const memSeries = pts.map(p => p.mem)
  const diskSeries = pts.map(p => p.disk)
  const tsSeries = pts.map(p => p.ts)
  const gb = (mb) => (mb / 1024).toFixed(1)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Resource Trends</h3>
          <div className="flex items-center gap-1.5">
            <select
              value={range}
              onChange={e => {
                const v = e.target.value
                changeRange(v === 'live' ? 'live' : Number(v))
              }}
              className="text-[10px] text-gray-400 bg-transparent border-0 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none appearance-none"
              aria-label="Trend time range"
            >
              {TREND_RANGES.map(r => (
                <option key={r.value} value={r.value} className="text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900">
                  {r.label}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-gray-400">· live</span>
          </div>
        </div>
        <MetricChart
          label="CPU"
          values={cpuSeries}
          times={tsSeries}
          color="emerald"
          live={stats.cpu_usage_percent}
          format={v => `${v}%`}
          usage={`${stats.cpu_count} cores`}
          domain={[0, 100]}
        />
        <MetricChart
          label="Memory"
          values={memSeries}
          times={tsSeries}
          color="blue"
          live={stats.memory_used_percent}
          format={v => `${v}%`}
          usage={`${gb(stats.memory_used_mb)} / ${gb(stats.memory_total_mb)} GB`}
          domain={[0, 100]}
        />
        <MetricChart
          label="Storage"
          values={diskSeries}
          times={tsSeries}
          color="amber"
          live={stats.disk_used_percent}
          format={v => `${v}%`}
          usage={`${stats.disk_used_gb} / ${stats.disk_total_gb} GB`}
          domain={[0, 100]}
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
    let active = true
    const load = () => {
      apiFetch(`/api/docker/${item.id}`)
        .then(r => r.json())
        .then(d => { if (active) { setDetail(d); setLoading(false) } })
        .catch(() => { if (active) setLoading(false) })
    }
    setLoading(true)
    load()
    const interval = setInterval(load, 3000)
    return () => { active = false; clearInterval(interval) }
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

export default function DetailPanel({ item, type, onClose, onEdit, latencyHistory, historyStats, systemStats }) {
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
            {type === 'system' && <SystemDetail stats={systemStats} />}
          </div>
        )}
      </div>
    </div>
  )
}