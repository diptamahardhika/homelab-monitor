import { useState, useEffect } from 'react'

function ConfigEditor({ onClose, onSaved }) {
  const [config, setConfig] = useState({ servers: [], services: [], port: 9876 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('servers')
  const [editingServer, setEditingServer] = useState(null)
  const [editingService, setEditingService] = useState(null)
  const [showServerForm, setShowServerForm] = useState(false)
  const [showServiceForm, setShowServiceForm] = useState(false)

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => setConfig(data))
      .catch(() => setError('Failed to load config'))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save config')
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const addServer = () => {
    setEditingServer({ name: '', host: '', port: 22, type: 'tcp', gateway: '', timeout: 5000, expected_status: 0, follow_redirects: false, insecure_skip_verify: false })
    setShowServerForm(true)
  }

  const editServer = (s) => {
    setEditingServer({ ...s, timeout: s.Timeout || 5000 })
    setShowServerForm(true)
  }

  const saveServer = () => {
    const servers = [...config.servers]
    const idx = servers.findIndex(s => s.name === editingServer.name)
    if (idx >= 0) servers[idx] = editingServer
    else servers.push(editingServer)
    setConfig({ ...config, servers })
    setShowServerForm(false)
    setEditingServer(null)
  }

  const deleteServer = (name) => {
    setConfig({ ...config, servers: config.servers.filter(s => s.name !== name) })
  }

  const addService = () => {
    setEditingService({ name: '', url: '', type: 'http', timeout: 10000, expected_status: 0, follow_redirects: false, insecure_skip_verify: false })
    setShowServiceForm(true)
  }

  const editService = (s) => {
    setEditingService({ ...s, timeout: s.Timeout || 10000 })
    setShowServiceForm(true)
  }

  const saveService = () => {
    const services = [...config.services]
    const idx = services.findIndex(s => s.name === editingService.name)
    if (idx >= 0) services[idx] = editingService
    else services.push(editingService)
    setConfig({ ...config, services })
    setShowServiceForm(false)
    setEditingService(null)
  }

  const deleteService = (name) => {
    setConfig({ ...config, services: config.services.filter(s => s.name !== name) })
  }

  const durationToMs = (dur) => {
    if (!dur) return ''
    if (typeof dur === 'number') return dur
    if (typeof dur === 'string') {
      const match = dur.match(/^(\d+)(ms|s|m|h)$/)
      if (match) {
        const val = parseInt(match[1])
        const unit = match[2]
        if (unit === 'ms') return val
        if (unit === 's') return val * 1000
        if (unit === 'm') return val * 60 * 1000
        if (unit === 'h') return val * 60 * 60 * 1000
      }
    }
    return ''
  }

  const msToDuration = (ms) => {
    if (!ms) return '5s'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${ms / 1000}s`
    if (ms < 3600000) return `${ms / 60000}m`
    return `${ms / 3600000}h`
  }

  if (activeTab === 'servers') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 dark:text-white">TCP Servers</h3>
          <button onClick={addServer} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500">+ Add Server</button>
        </div>
        {config.servers.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-800 p-8 text-center bg-gray-50 dark:bg-gray-900/30">
            <p className="text-gray-500">No servers configured</p>
          </div>
        )}
        <div className="space-y-2">
          {config.servers.map((s, i) => (
            <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{s.name}</p>
                <p className="text-sm text-gray-500">{s.host}:{s.port} ({s.type})</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => editServer(s)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded">Edit</button>
                <button onClick={() => deleteServer(s.name)} className="text-red-500 hover:text-red-700 p-1 rounded">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (activeTab === 'services') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 dark:text-white">HTTP/TCP Services</h3>
          <button onClick={addService} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500">+ Add Service</button>
        </div>
        {config.services.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-800 p-8 text-center bg-gray-50 dark:bg-gray-900/30">
            <p className="text-gray-500">No services configured</p>
          </div>
        )}
        <div className="space-y-2">
          {config.services.map((s, i) => (
            <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{s.name}</p>
                <p className="text-sm text-gray-500 truncate">{s.url} ({s.type})</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => editService(s)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded">Edit</button>
                <button onClick={() => deleteService(s.name)} className="text-red-500 hover:text-red-700 p-1 rounded">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 dark:text-white">General Settings</h3>
      </div>
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
        <input type="number" value={config.port} onChange={e => setConfig({...config, port: parseInt(e.target.value)})} className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm" />
      </div>
    </div>
  )
}

export default ConfigEditor