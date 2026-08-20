import { useState } from 'react'
import { Dot, Trend, EmptyState } from './ui'

export function ServerCard({ server, onClick, latencyHistory, onEdit, onDelete, onConfirmDelete, onCancelDelete, confirmingDelete }) {
  const actions = onEdit || onDelete ? (
    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-1.5">
      {confirmingDelete ? (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onConfirmDelete(server.name) }}
            className="rounded bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600 transition-colors"
            aria-label={`Confirm delete ${server.name}`}
          >
            Delete
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCancelDelete() }}
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

export default function ServerList({ servers, latencyHistory, onOpen, onEdit, onDelete, onAdd }) {
  const [confirmingDelete, setConfirmingDelete] = useState(null)

  return (
    <section id="servers-section" className="mb-8">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Servers <span className="text-sm font-normal text-gray-400">({servers.length})</span>
        </h2>
        <button onClick={onAdd}
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
              latencyHistory={latencyHistory[s.name]}
              onClick={() => onOpen(s)}
              onEdit={onEdit}
              onDelete={(name) => setConfirmingDelete(name)}
              onCancelDelete={() => setConfirmingDelete(null)}
              onConfirmDelete={onDelete}
              confirmingDelete={confirmingDelete === s.name}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No servers configured"
          hint="Add a server to start monitoring its reachability."
          action={
            <button onClick={onAdd}
              className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors">
              + Add Server
            </button>
          }
        />
      )}
    </section>
  )
}