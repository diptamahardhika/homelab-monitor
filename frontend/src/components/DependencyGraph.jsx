import { useState, useEffect, useMemo, useCallback } from 'react'
import { NODE_W, NODE_H, GAP_X, layoutGraph, nodeMeta } from '../lib/graphLayout'

function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function AddDependencyModal({ servers, services, existing, initial, onClose, onAdded, onError }) {
  const isEdit = Boolean(initial)
  const [from, setFrom] = useState(initial?.from || '')
  const [to, setTo] = useState(initial?.to || '')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)

  const groups = [
    { label: 'Services', names: services.map(s => s.name) },
    { label: 'Servers', names: servers.map(s => s.name) },
  ].filter(g => g.names.length > 0)
  const existingKey = new Set(
    existing
      .filter(d => !(isEdit && d.from === initial.from && d.to === initial.to))
      .map(d => `${d.from}\u0000${d.to}`)
  )

  const placeholder = groups.length === 0 ? 'Nothing to connect' : 'Select a service or server…'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!from || !to) {
      setError('Both entries are required')
      return
    }
    if (from === to) {
      setError('A service cannot depend on itself')
      return
    }
    if (existingKey.has(`${from}\u0000${to}`)) {
      setError('That dependency already exists')
      return
    }
    setAdding(true)
    setError(null)
    try {
      const url = isEdit
        ? `/api/dependencies?from=${encodeURIComponent(initial.from)}&to=${encodeURIComponent(initial.to)}`
        : '/api/dependencies'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      })
      if (!res.ok) {
        let msg = isEdit ? 'Failed to update dependency' : 'Failed to add dependency'
        try {
          const data = await res.json()
          msg = data.error || msg
        } catch (_) {}
        throw new Error(msg)
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{isEdit ? 'Edit Dependency' : 'Add Dependency'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Depends on</label>
            <select value={from} onChange={e => setFrom(e.target.value)} disabled={groups.length === 0}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50">
              <option value="">{placeholder}</option>
              {groups.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.names.map(n => <option key={n} value={n}>{n}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Required by</label>
            <select value={to} onChange={e => setTo(e.target.value)} disabled={groups.length === 0}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50">
              <option value="">{placeholder}</option>
              {groups.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.names.map(n => <option key={n} value={n}>{n}</option>)}
                </optgroup>
              ))}
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

export default function DependencyGraph({ servers, services, containers, dark, onOpenServer, onOpenService, onOpenContainer, showToast }) {
  const [deps, setDeps] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [tableCollapsed, setTableCollapsed] = useState(true)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  const fetchDeps = useCallback(async () => {
    try {
      const res = await fetch('/api/dependencies')
      const data = await res.json()
      setDeps(Array.isArray(data) ? data : [])
    } catch (_) {
      setDeps([])
    }
  }, [])

  useEffect(() => { fetchDeps() }, [fetchDeps])

  const graph = useMemo(() => layoutGraph(deps || []), [deps])

  const openNode = (name) => {
    const meta = nodeMeta(name, servers, services, containers)
    if (!meta.item) return
    if (meta.kind === 'server') onOpenServer(meta.item)
    else if (meta.kind === 'service') onOpenService(meta.item)
    else if (meta.kind === 'container') onOpenContainer(meta.item)
  }

  const removeDependency = async (from, to) => {
    setConfirming(null)
    try {
      const res = await fetch(`/api/dependencies?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { method: 'DELETE' })
      if (!res.ok) {
        let msg = `Failed to delete (${res.status})`
        try {
          const data = await res.json()
          msg = data.error || msg
        } catch (_) {}
        throw new Error(msg)
      }
      showToast(`Removed "${from} → ${to}"`)
      fetchDeps()
    } catch (e) {
      showToast(e.message || 'Failed to delete', 'error')
    }
  }

  const openEdit = (from, to) => {
    setConfirming(null)
    setEditing({ from, to })
  }

  const resetDrag = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDrop = (targetIndex) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      resetDrag()
      return
    }
    const next = [...graph.edges]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(targetIndex, 0, moved)
    resetDrag()
    setDeps(next)
    const persist = async () => {
      try {
        const res = await fetch('/api/dependencies/order', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        })
        if (!res.ok) {
          let msg = `Failed to reorder (${res.status})`
          try {
            const data = await res.json()
            msg = data.error || msg
          } catch (_) {}
          throw new Error(msg)
        }
        fetchDeps()
      } catch (e) {
        showToast(e.message || 'Failed to reorder', 'error')
        fetchDeps()
      }
    }
    persist()
  }

  if (deps === null) {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Dependencies</h2>
        <div className="h-40 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 animate-pulse" />
      </section>
    )
  }

  const fill = dark ? '#0f172a' : '#ffffff'
  const textFill = dark ? '#f8fafc' : '#0f172a'
  const subFill = dark ? '#94a3b8' : '#64748b'
  const edgeStroke = dark ? '#334155' : '#cbd5e1'

  return (
    <section className="mb-8" id="dependencies-section">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <button
          onClick={() => setTableCollapsed(c => !c)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title={tableCollapsed ? 'Show dependency list' : 'Hide dependency list'}
          aria-expanded={!tableCollapsed}>
          <svg
            className={`w-4 h-4 transition-transform ${tableCollapsed ? '' : 'rotate-180'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Dependencies <span className="text-sm font-normal text-gray-400">({graph.edges.length})</span>
        </button>
        <button onClick={() => setShowAdd(true)}
          disabled={services.length === 0 && servers.length === 0}
          title={services.length === 0 && servers.length === 0 ? 'Add a service or server first' : 'Add dependency'}
          className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none">
          + Add Dependency
        </button>
      </div>

      {graph.nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-800 p-8 text-center">
          <p className="text-sm font-medium text-gray-500">No dependencies defined</p>
          <p className="mt-1 text-xs text-gray-400">Declare which service or server depends on another to visualize the graph.</p>
          {(services.length > 0 || servers.length > 0) && (
            <button onClick={() => setShowAdd(true)}
              className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors">
              + Add Dependency
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 overflow-x-auto">
            <svg viewBox={`0 0 ${graph.W} ${graph.H}`} className="min-w-[480px]" role="img" aria-label="Service dependency graph">
              {graph.edges.map((e, i) => {
                const s = graph.pos.get(e.from)
                const t = graph.pos.get(e.to)
                if (!s || !t) return null
                const sx = s.x + NODE_W
                const sy = s.y + NODE_H / 2
                const tx = t.x
                const ty = t.y + NODE_H / 2
                const mid = GAP_X / 2
                return (
                  <g key={`e${i}`}>
                    <title>{`${e.from} → ${e.to}`}</title>
                    <path
                      d={`M ${sx} ${sy} C ${sx + mid} ${sy}, ${tx - mid} ${ty}, ${tx} ${ty}`}
                      fill="none"
                      stroke={edgeStroke}
                      strokeWidth="1.5"
                    />
                  </g>
                )
              })}
              {graph.nodes.map(name => {
                const p = graph.pos.get(name)
                if (!p) return null
                const meta = nodeMeta(name, servers, services, containers)
                const clickable = Boolean(meta.item)
                const dash = meta.kind === 'unknown' ? '6 4' : undefined
                return (
                  <g
                    key={name}
                    transform={`translate(${p.x}, ${p.y})`}
                    onClick={clickable ? () => openNode(name) : undefined}
                    style={clickable ? { cursor: 'pointer' } : undefined}
                  >
                    <title>{clickable ? `${name} (${meta.kind}) — click for details` : `${name} (unknown)`}</title>
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx="8"
                      fill={fill}
                      stroke={meta.color}
                      strokeWidth="1.5"
                      strokeDasharray={dash}
                    />
                    <circle cx="14" cy="20" r="4" fill={meta.color} />
                    <text x="26" y="22" fontSize="12" fontWeight="600" fill={textFill}>{truncate(name, 17)}</text>
                    <text x="26" y="34" fontSize="9" fill={subFill}>{meta.kind}</text>
                  </g>
                )
              })}
            </svg>
          </div>

          {!tableCollapsed && graph.edges.length > 0 && (
            <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="py-3 pl-4 pr-1 w-8"></th>
                    <th className="py-3 pl-1 pr-2 w-1/2">Depends on</th>
                    <th className="py-3 px-2 w-1/2">Required by</th>
                    <th className="py-3 pr-4 pl-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {graph.edges.map((e, i) => (
                    <tr
                      key={i}
                      draggable
                      onDragStart={(ev) => {
                        ev.dataTransfer.effectAllowed = 'move'
                        ev.dataTransfer.setData('text/plain', String(i))
                        setDragIndex(i)
                      }}
                      onDragOver={(ev) => {
                        if (dragIndex === null) return
                        ev.preventDefault()
                        ev.dataTransfer.dropEffect = 'move'
                        if (dragOverIndex !== i) setDragOverIndex(i)
                      }}
                      onDrop={(ev) => {
                        ev.preventDefault()
                        handleDrop(i)
                      }}
                      onDragEnd={resetDrag}
                      className={`border-b border-gray-50 dark:border-gray-800/50 last:border-0 ${
                        dragIndex === i ? 'opacity-40' : ''
                      } ${dragOverIndex === i && dragIndex !== null ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
                      title="Drag to reorder"
                    >
                      <td className="py-2 pl-4 pr-1">
                        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M9 5a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM9 12a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM9 19a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </td>
                      <td className="py-2 pl-1 pr-2">
                        <button onClick={() => openNode(e.from)} className="text-sm font-medium text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                          {e.from}
                        </button>
                      </td>
                      <td className="py-2 px-2">
                        <button onClick={() => openNode(e.to)} className="text-sm font-medium text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                          {e.to}
                        </button>
                      </td>
                      <td className="py-2 pr-4 pl-2 text-right">
                        {confirming === `${e.from}\u0000${e.to}` ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => removeDependency(e.from, e.to)}
                              className="rounded bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600 transition-colors"
                              title="Confirm delete">
                              Yes
                            </button>
                            <button onClick={() => setConfirming(null)}
                              className="rounded border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              title="Cancel delete">
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => openEdit(e.from, e.to)}
                              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                              title={`Edit ${e.from} → ${e.to}`}
                              aria-label={`Edit ${e.from} to ${e.to}`}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => setConfirming(`${e.from}\u0000${e.to}`)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                              title={`Remove ${e.from} → ${e.to}`}
                              aria-label={`Remove ${e.from} to ${e.to}`}>
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
          )}
        </>
      )}

      {showAdd && (
        <AddDependencyModal
          servers={servers}
          services={services}
          existing={graph.edges}
          onClose={() => setShowAdd(false)}
          onAdded={() => { fetchDeps(); showToast('Dependency added') }}
          onError={msg => showToast(msg, 'error')}
        />
      )}
      {editing && (
        <AddDependencyModal
          servers={servers}
          services={services}
          existing={graph.edges}
          initial={editing}
          onClose={() => setEditing(null)}
          onAdded={() => { fetchDeps(); showToast('Dependency updated') }}
          onError={msg => showToast(msg, 'error')}
        />
      )}
    </section>
  )
}