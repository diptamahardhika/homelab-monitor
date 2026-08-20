import { useState } from 'react'
import { FilterChips, SearchInput, SortHeader, StatusBadge, Trend, UptimeBadge, EmptyState, filterAndSort, toggleSort, statusRank } from './ui'

export default function ServiceList({ services, latencyHistory, historyStats, onOpen, onDelete, onAdd }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [confirmingDelete, setConfirmingDelete] = useState(null)

  const filtered = filter === 'all' ? services : services.filter(s => s.status === filter)
  const visible = filterAndSort(filtered, search, sort, s => s.name, statusRank, s => parseInt(s.latency, 10))

  return (
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
            value={filter}
            onChange={setFilter}
          />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search services..."
          />
          <button onClick={onAdd}
            className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white">
            + Add Service
          </button>
        </div>
      </div>
      {services.length > 0 ? (
        visible.length === 0 ? (
          <EmptyState title="No services match your search" hint="Try a different search term." />
        ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 backdrop-blur-sm overflow-x-auto transition-colors">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortHeader label="Service" sortKey="name" sort={sort} onSort={k => toggleSort(setSort, k)} className="py-3 pl-4 pr-2 w-1/2" />
                <SortHeader label="Status" sortKey="status" sort={sort} onSort={k => toggleSort(setSort, k)} />
                <th className="py-3 px-2">Code</th>
                <SortHeader label="Latency" sortKey="latency" sort={sort} onSort={k => toggleSort(setSort, k)} />
                <th className="py-3 px-2">Uptime</th>
                <th className="py-3 pr-4 pl-2 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <td className="py-0 pl-4 pr-2">
                    <button onClick={() => onOpen(s)} className="group flex items-center w-full py-3 text-left">
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
                      <Trend history={latencyHistory[s.name]} />
                    </span>
                  </td>
                  <td className="py-3 px-2"><UptimeBadge stats={historyStats[`service:${s.name}`]} /></td>
                  <td className="py-3 pr-4 pl-2 w-28 whitespace-nowrap">
                    {confirmingDelete === s.name ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => { onDelete(s.name); setConfirmingDelete(null) }}
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
            <button onClick={onAdd}
              className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors">
              + Add Service
            </button>
          }
        />
      )}
    </section>
  )
}