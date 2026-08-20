import { useEffect, useRef, useState } from 'react'
import { SunIcon, MoonIcon, GearIcon, LockIcon, formatRelative } from './ui'

export const LIVE_INDICATOR = {
  loading: { dot: 'bg-gray-400', text: 'text-gray-400', label: 'Connecting…', pulse: false, title: 'Connecting to the live update stream' },
  live:    { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: 'Live', pulse: false, title: 'Receiving live updates' },
  polling: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', label: 'Reconnecting…', pulse: true, title: 'Live stream lost — falling back to polling' },
  stale:   { dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', label: 'Stale', pulse: true, title: 'No fresh data — check the backend' },
}

export default function Header({
  dark,
  onToggleTheme,
  onLock,
  liveStatus,
  lastUpdated,
  now,
  refreshing,
  onManualRefresh,
  onExport,
  onImport,
  version,
  commit,
  commitTime,
}) {
  const [showConfigMenu, setShowConfigMenu] = useState(false)
  const fileInputRef = useRef(null)
  const configMenuRef = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (configMenuRef.current && !configMenuRef.current.contains(e.target)) {
        setShowConfigMenu(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const status = liveStatus === 'loading' ? LIVE_INDICATOR.loading : LIVE_INDICATOR[liveStatus]

  return (
    <>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HomeLab Monitor</h1>
          <p className="mt-1 text-sm text-gray-500">Real-time status of your infrastructure</p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="hidden sm:flex items-center gap-2 text-xs"
            title={status.title}
            aria-live="polite"
          >
            <span className={`flex items-center gap-1.5 font-medium ${status.text}`}>
              <span className={`h-2 w-2 rounded-full ${status.dot} ${status.pulse ? 'animate-pulse' : ''}`} />
              {status.label}
            </span>
            <span className="text-gray-400">{lastUpdated ? `Updated ${formatRelative(lastUpdated, now)}` : 'Waiting for first update'}</span>
          </div>
          <button
            onClick={onToggleTheme}
            className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-2 text-gray-500 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-700 dark:hover:text-white active:scale-95"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            onClick={onLock}
            className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-2 text-gray-500 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-700 dark:hover:text-white active:scale-95"
            title="Lock dashboard"
            aria-label="Lock dashboard"
          >
            <LockIcon />
          </button>
          <div className="relative" ref={configMenuRef}>
            <button
              onClick={() => setShowConfigMenu(v => !v)}
              className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-2 text-gray-500 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-700 dark:hover:text-white active:scale-95"
              title="Config: export or import"
              aria-label="Config: export or import"
              aria-expanded={showConfigMenu}
            >
              <GearIcon />
            </button>
            {showConfigMenu && (
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg py-1.5">
                <button
                  onClick={onExport}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Export config (JSON)
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Import config (JSON)
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    onImport(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </div>
            )}
          </div>
          <button
            onClick={onManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-900/80 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Refresh data"
          >
            {refreshing ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <footer className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 flex-wrap text-xs text-gray-400">
        <span>HomeLab Monitor</span>
        <a href="https://github.com/diptamahardhika/homelab-monitor" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 dark:hover:text-gray-300">
          {commit ? (
            <span className="font-mono">{commit}{commitTime && ` · ${formatRelative(new Date(commitTime).getTime(), now)}`}</span>
          ) : version && <span className="font-mono">v{version}</span>}
        </a>
      </footer>
    </>
  )
}