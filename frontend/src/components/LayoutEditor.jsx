import { useState, useEffect } from 'react'

const DEFAULT_LAYOUT = [
  { id: 'stats', title: 'Statistics Cards', visible: true, order: 0 },
  { id: 'servers', title: 'Servers', visible: true, order: 1 },
  { id: 'services', title: 'Services', visible: true, order: 2 },
  { id: 'containers', title: 'Containers', visible: true, order: 3 },
  { id: 'system', title: 'System Details', visible: true, order: 4 },
]

function LayoutEditor({ onClose, onSaved }) {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  const [saving, setSaving] = useState(false)
  const [draggingId, setDraggingId] = useState(null)

  useEffect(() => {
    // Load saved layout from localStorage
    const saved = localStorage.getItem('dashboard-layout')
    if (saved) {
      try {
        setLayout(JSON.parse(saved))
      } catch {
        // use default
      }
    }
  }, [])

  const handleDragStart = (e, id) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, targetId) => {
    e.preventDefault()
    if (!draggingId || draggingId === targetId) return

    setLayout(prev => {
      const items = [...prev]
      const fromIndex = items.findIndex(item => item.id === draggingId)
      const toIndex = items.findIndex(item => item.id === targetId)
      if (fromIndex === -1 || toIndex === -1) return prev

      const [moved] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, moved)
      
      // Reorder
      return items.map((item, i) => ({ ...item, order: i }))
    })
    setDraggingId(null)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
  }

  const toggleVisibility = (id) => {
    setLayout(prev => prev.map(item => 
      item.id === id ? { ...item, visible: !item.visible } : item
    ))
  }

  const moveUp = (id) => {
    setLayout(prev => {
      const items = [...prev]
      const index = items.findIndex(item => item.id === id)
      if (index <= 0) return prev
      const [moved] = items.splice(index, 1)
      items.splice(index - 1, 0, moved)
      return items.map((item, i) => ({ ...item, order: i }))
    })
  }

  const moveDown = (id) => {
    setLayout(prev => {
      const items = [...prev]
      const index = items.findIndex(item => item.id === id)
      if (index >= items.length - 1) return prev
      const [moved] = items.splice(index, 1)
      items.splice(index + 1, 0, moved)
      return items.map((item, i) => ({ ...item, order: i }))
    })
  }

  const handleSave = () => {
    localStorage.setItem('dashboard-layout', JSON.stringify(layout))
    onSaved(layout)
    onClose()
  }

  const resetToDefault = () => {
    setLayout(DEFAULT_LAYOUT)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-md mx-4 animate-in slide-in-from-top-2 duration-200">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Dashboard Layout</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[60vh] overflow-auto">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Drag to reorder. Click eye to show/hide. Changes saved to browser.
          </p>

          {layout.map((section, index) => (
            <div
              key={section.id}
              draggable
              onDragStart={e => handleDragStart(e, section.id)}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, section.id)}
              onDragEnd={handleDragEnd}
              className={`relative flex items-center gap-3 p-3 rounded-lg border transition-all ${
                draggingId === section.id 
                  ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 opacity-50' 
                  : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
              style={{ cursor: 'grab' }}
            >
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{section.title}</p>
                <p className="text-xs text-gray-500 capitalize">{section.id} section</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleVisibility(section.id)}
                  className={`p-1.5 rounded transition-colors ${
                    section.visible
                      ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                      : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title={section.visible ? 'Hide section' : 'Show section'}
                >
                  {section.visible ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  )}
                </button>

                <button
                  onClick={() => moveUp(section.id)}
                  disabled={index === 0}
                  className="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>

                <button
                  onClick={() => moveDown(section.id)}
                  disabled={index === layout.length - 1}
                  className="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
            </div>
          ))}

          <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={resetToDefault}
              className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Reset to defaults
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-800">
          <button onClick={onClose} className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Layout'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default LayoutEditor