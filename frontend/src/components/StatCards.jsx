import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { StatCard, MiniSparkline } from './ui'

function TrendRow({ label, values, color, format }) {
  if (!values || values.length < 2) return null
  const last = values[values.length - 1]
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-[10px] font-medium text-gray-400 uppercase">{label}</span>
      <div className="min-w-0 flex-1">
        <MiniSparkline values={values} color={color} height={16} width={90} />
      </div>
      <span className="w-9 shrink-0 text-right text-[10px] font-mono text-gray-500 dark:text-gray-400">
        {format ? format(last) : Math.round(last)}
      </span>
    </div>
  )
}

export default function StatCards({ servers, services, containers, systemStats, onScrollServers, onScrollServices, onScrollContainers, onOpenSystem }) {
  const [sysSeries, setSysSeries] = useState([])

  useEffect(() => {
    let active = true
    const load = () => {
      apiFetch('/api/system/history?hours=24')
        .then(r => r.json())
        .then(d => { if (active && Array.isArray(d?.samples)) setSysSeries(d.samples) })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 60000)
    return () => { active = false; clearInterval(id) }
  }, [])

  const cpuPct = systemStats?.cpu_usage_percent ?? 0
  const systemAccent = cpuPct < 50
    ? 'text-emerald-600 dark:text-emerald-400'
    : cpuPct < 70
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-rose-600 dark:text-rose-400'

  const upCount = servers.filter(s => s.alive).length
  const servicesUp = services.filter(s => s.status === 'up').length
  const runningContainers = containers.filter(c => c.state === 'running').length

  const cpuSeries = sysSeries.map(s => s.cpu)
  const memSeries = sysSeries.map(s => s.memory_used_percent)
  const diskSeries = sysSeries.map(s => s.disk_used_percent)

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Servers" value={`${upCount}/${servers.length}`} accent="text-emerald-600 dark:text-emerald-400" onClick={onScrollServers} subtitle={servers.length === 0 ? 'none configured' : ''} />
      <StatCard title="Services" value={`${servicesUp}/${services.length}`} accent="text-blue-600 dark:text-blue-400" onClick={onScrollServices} subtitle={services.length === 0 ? 'none configured' : ''} />
      <StatCard title="Containers" value={`${runningContainers}/${containers.length}`} accent="text-purple-600 dark:text-purple-400" onClick={onScrollContainers} subtitle={containers.length === 0 ? 'no docker' : ''} />
      <StatCard
        title="System"
        value={systemStats ? `${systemStats.cpu_usage_percent}%` : '-'}
        accent={systemAccent}
        onClick={onOpenSystem}
        subtitle={systemStats ? `${systemStats.memory_used_percent}% RAM · ${systemStats.disk_used_percent}% disk` : ''}
      >
        <div className="mt-3 space-y-1.5">
          <TrendRow label="CPU" values={cpuSeries} color="emerald" />
          <TrendRow label="RAM" values={memSeries} color="blue" />
          <TrendRow label="Disk" values={diskSeries} color="amber" format={v => `${Math.round(v)}%`} />
        </div>
      </StatCard>
    </div>
  )
}