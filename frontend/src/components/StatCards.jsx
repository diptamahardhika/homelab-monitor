import { StatCard } from './ui'

export default function StatCards({ servers, services, containers, systemStats, onScrollServers, onScrollServices, onScrollContainers, onOpenSystem }) {
  const cpuPct = systemStats?.cpu_usage_percent ?? 0
  const systemAccent = cpuPct < 50
    ? 'text-emerald-600 dark:text-emerald-400'
    : cpuPct < 70
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-rose-600 dark:text-rose-400'

  const upCount = servers.filter(s => s.alive).length
  const servicesUp = services.filter(s => s.status === 'up').length
  const runningContainers = containers.filter(c => c.state === 'running').length

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
      />
    </div>
  )
}