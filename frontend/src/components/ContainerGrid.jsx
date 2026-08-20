import { useState } from 'react'
import { FilterChips, SearchInput, SortHeader, StatusBadge, PortLinks, EmptyState, filterAndSort, toggleSort, containerRank } from './ui'

function MiniUsage({ pct, fill }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const hot = clamped >= 90
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full transition-all ${hot ? 'bg-rose-500' : fill}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-500 tabular-nums">{Math.round(pct)}%</span>
    </div>
  )
}

export default function ContainerGrid({ containers, onOpen }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'status', dir: 'asc' })

  const filtered = filter === 'all' ? containers : containers.filter(c => c.state === filter)
  const visible = filterAndSort(filtered, search, sort, c => c.name || c.id, containerRank, c => null, c => c.state, c => c.status, true)

  return (
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
            value={filter}
            onChange={setFilter}
          />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search containers..."
          />
        </div>
      </div>
      {containers.length > 0 ? (
        visible.length === 0 ? (
          <EmptyState title="No containers match your search" hint="Try a different search term." />
        ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 backdrop-blur-sm overflow-x-auto transition-colors">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortHeader label="Container" sortKey="name" sort={sort} onSort={k => toggleSort(setSort, k)} className="py-3 pl-4 pr-2 w-1/2" />
                <SortHeader label="State" sortKey="status" sort={sort} onSort={k => toggleSort(setSort, k)} />
                <th className="py-3 pl-2 pr-2">CPU</th>
                <th className="py-3 pl-2 pr-2">Mem</th>
                <SortHeader label="Status" sortKey="statustext" sort={sort} onSort={k => toggleSort(setSort, k)} />
                <th className="py-3 pl-2 pr-4">Ports</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <td className="py-0 pl-5 pr-2">
                    <button onClick={() => onOpen(c)} className="group flex items-center w-full py-3 text-left">
                      <span className={`w-1.5 h-1.5 rounded-full mr-3 shrink-0 ${c.state === 'running' ? 'bg-emerald-500 dark:bg-emerald-400' : c.state === 'paused' ? 'bg-amber-500 dark:bg-amber-400' : 'bg-gray-400 dark:bg-gray-500'}`} />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">{c.name || c.id}</p>
                        <p className="text-xs text-gray-500 truncate">{c.image}</p>
                      </div>
                    </button>
                  </td>
                  <td className="py-3 px-2"><StatusBadge status={c.state} /></td>
                  <td className="py-3 px-2">
                    {c.stats ? <MiniUsage pct={c.stats.cpu_percent} fill="bg-emerald-500" /> : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="py-3 px-2">
                    {c.stats ? <MiniUsage pct={c.stats.memory_percent} fill="bg-blue-500" /> : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-500 truncate max-w-[200px]">{c.status}</td>
                  <td className="py-3 pl-2 pr-4 text-xs text-gray-500 truncate max-w-[160px]"><PortLinks ports={c.ports} /></td>
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
  )
}