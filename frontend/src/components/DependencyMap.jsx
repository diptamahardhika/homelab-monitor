import { useState, useEffect, useRef } from 'react'

function DependencyMap({ services, onClose }) {
  const [dependencies, setDependencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [fromService, setFromService] = useState('')
  const [toService, setToService] = useState('')
  const [error, setError] = useState(null)
  const canvasRef = useRef(null)
  const animationRef = useRef(null)

  // Combine config services + dynamic services
  const allServices = [
    ...services.map(s => ({ name: s.name, type: s.type || 'http', status: s.status })),
  ]

  useEffect(() => {
    fetch('/api/dependencies')
      .then(r => r.json())
      .then(data => {
        setDependencies(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load dependencies')
        setLoading(false)
      })
  }, [])

  const drawGraph = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)

    // Build service positions (circular layout)
    const serviceNames = [...new Set([
      ...dependencies.flatMap(d => [d.from, d.to]),
      ...allServices.map(s => s.name)
    ])]
    
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const radius = Math.min(rect.width, rect.height) * 0.35
    
    const positions = {}
    serviceNames.forEach((name, i) => {
      const angle = (i / serviceNames.length) * Math.PI * 2 - Math.PI / 2
      positions[name] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      }
    })

    // Draw edges first
    dependencies.forEach(dep => {
      const from = positions[dep.from]
      const to = positions[dep.to]
      if (!from || !to) return

      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      
      // Curved arrow
      const midX = (from.x + to.x) / 2
      const midY = (from.y + to.y) / 2
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const offsetX = -dy / dist * 30
      const offsetY = dx / dist * 30
      
      ctx.quadraticCurveTo(midX + offsetX, midY + offsetY, to.x, to.y)
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.stroke()

      // Arrowhead
      const angle = Math.atan2(to.y - (midY + offsetY), to.x - (midX + offsetX))
      const headLen = 10
      ctx.beginPath()
      ctx.moveTo(to.x, to.y)
      ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6), to.y - headLen * Math.sin(angle - Math.PI / 6))
      ctx.moveTo(to.x, to.y)
      ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6), to.y - headLen * Math.sin(angle + Math.PI / 6))
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.stroke()
    })

    // Draw nodes
    serviceNames.forEach(name => {
      const pos = positions[name]
      if (!pos) return

      const service = allServices.find(s => s.name === name)
      const isDown = service && service.status === 'down'
      const isContainer = name.startsWith('/') || (service && service.type === 'container')

      // Node circle
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 28, 0, Math.PI * 2)
      ctx.fillStyle = isDown ? '#fef2f2' : (isContainer ? '#f3f4f6' : '#f0fdf4')
      ctx.fill()
      
      ctx.strokeStyle = isDown ? '#ef4444' : (isContainer ? '#6b7280' : '#22c55e')
      ctx.lineWidth = isDown ? 3 : 2
      ctx.stroke()

      // Icon
      ctx.fillStyle = isDown ? '#ef4444' : (isContainer ? '#6b7280' : '#22c55e')
      ctx.font = '16px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(isContainer ? '🐳' : '🌐', pos.x, pos.y - 2)

      // Name
      ctx.fillStyle = '#111827'
      ctx.font = '11px system-ui'
      ctx.fillText(name.length > 14 ? name.slice(0, 14) + '...' : name, pos.x, pos.y + 22)
    })
  }

  useEffect(() => {
    const resize = () => drawGraph()
    window.addEventListener('resize', resize)
    drawGraph()
    return () => window.removeEventListener('resize', resize)
  }, [dependencies, allServices])

  const handleAddDependency = async (e) => {
    e.preventDefault()
    if (!fromService || !toService || fromService === toService) return
    
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromService, to: toService }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add dependency')
      }
      const newDep = { from: fromService, to: toService }
      setDependencies(prev => [...prev, newDep])
      setFromService('')
      setToService('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteDependency = async (from, to) => {
    try {
      const res = await fetch(`/api/dependencies?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      setDependencies(prev => prev.filter(d => d.from !== from || d.to !== to))
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-950 rounded-xl p-6 w-full max-w-md mx-4">
          <div className="flex items-center justify-center h-48 text-gray-500">Loading dependency graph...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-5xl h-[85vh] mx-4 my-4 animate-in slide-in-from-top-2 duration-200 flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Service Dependency Map</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-sm underline">Dismiss</button>
          </div>
        )}

        <div className="flex-1 relative overflow-hidden">
                    <canvas ref={canvasRef} className="w-full h-full" style={{ backgroundColor: '#fafafa' }} />
          
          {allServices.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              No services to display. Add services from the dashboard.
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-900/30">
          <div className="flex flex-wrap items-end gap-4 mb-3">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Depends on (From)</label>
              <select value={fromService} onChange={e => setFromService(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                <option value="">-- Select service --</option>
                {allServices.map(s => (
                  <option key={s.name} value={s.name}>{s.name} ({s.type})</option>
                ))}
              </select>
            </div>
            <div className="flex items-center text-gray-400 px-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dependency (To)</label>
              <select value={toService} onChange={e => setToService(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                <option value="">-- Select service --</option>
                {allServices.map(s => (
                  <option key={s.name} value={s.name}>{s.name} ({s.type})</option>
                ))}
              </select>
            </div>
            <button onClick={handleAddDependency} disabled={adding || !fromService || !toService || fromService === toService} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 shrink-0">
              {adding ? 'Adding...' : 'Add Dependency'}
            </button>
          </div>

          {dependencies.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-auto">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current Dependencies</p>
              {dependencies.map((dep, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-sm">
                  <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">{dep.from}</code>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">{dep.to}</code>
                  </span>
                  <button onClick={() => handleDeleteDependency(dep.from, dep.to)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30" title="Remove">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DependencyMap