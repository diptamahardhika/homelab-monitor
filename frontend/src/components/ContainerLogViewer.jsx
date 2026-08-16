import { useState, useEffect, useRef } from 'react'

function ContainerLogViewer({ containerId, containerName, onClose }) {
  const [logs, setLogs] = useState('')
  const [loading, setLoading] = useState(true)
  const [tailLines, setTailLines] = useState(100)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [error, setError] = useState(null)
  const logRef = useRef(null)
  const refreshIntervalRef = useRef(null)

  const fetchLogs = async () => {
    try {
      setError(null)
      const res = await fetch(`/api/docker/${containerId}/logs?tail=${tailLines}`)
      if (!res.ok) throw new Error(`Failed to fetch logs (${res.status})`)
      const text = await res.text()
      setLogs(text)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [containerId, tailLines])

  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(fetchLogs, 3000)
      return () => clearInterval(refreshIntervalRef.current)
    }
  }, [autoRefresh, containerId, tailLines])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const formatLogLine = (line) => {
    // Docker logs format: timestamp stream log
    // Try to parse and colorize
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(\w+)\s+(.*)$/)
    if (timestampMatch) {
      const [, timestamp, stream, message] = timestampMatch
      const isError = stream === 'stderr'
      return (
        <div className="font-mono text-xs" style={{ color: isError ? '#ef4444' : '#374151' }}>
          <span className="text-gray-400 mr-2">{timestamp}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium mr-2 ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {stream}
          </span>
          <span>{message}</span>
        </div>
      )
    }
    return <div className="font-mono text-xs text-gray-600">{line}</div>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-4xl h-[80vh] mx-4 animate-in slide-in-from-top-2 duration-200 flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{containerName}</h3>
              <p className="text-sm text-gray-500">Container Logs</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />
              Auto-refresh (3s)
            </label>
            <select value={tailLines} onChange={e => setTailLines(parseInt(e.target.value))} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 text-sm">
              <option value={50}>50 lines</option>
              <option value={100}>100 lines</option>
              <option value={200}>200 lines</option>
              <option value={500}>500 lines</option>
              <option value={1000}>1000 lines</option>
            </select>
            <button onClick={fetchLogs} disabled={loading} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50">
              Refresh
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchLogs} className="text-sm underline hover:no-underline">Retry</button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900" ref={logRef}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">Loading logs...</div>
          ) : logs ? (
            <pre className="font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
              {logs.split('\n').filter(l => l).map((line, i) => (
                <React.Fragment key={i}>
                  {formatLogLine(line)}
                </React.Fragment>
              ))}
            </pre>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">No logs available</div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-800 p-3 bg-white dark:bg-gray-950 text-xs text-gray-500 dark:text-gray-400 text-center">
          Tip: Check "Auto-refresh" to tail logs in real-time. Increase tail lines for more history.
        </div>
      </div>
    </div>
  )
}

export default ContainerLogViewer