import { useState } from 'react'
import { apiFetch } from '../api'

export function AddServiceModal({ initial, onClose, onAdded, onError }) {
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
      const res = await apiFetch(isEdit ? `/api/services/${encodeURIComponent(initial.name)}` : '/api/services', {
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

export function ServerModal({ initial, onClose, onAdded, onError }) {
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
      const res = await apiFetch(isEdit ? `/api/servers/${encodeURIComponent(initial.name)}` : '/api/servers', {
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