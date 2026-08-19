import { useEffect, useState } from 'react'
import Dashboard from './components/Dashboard'
import { getToken, setToken } from './api'

function TokenGate({ onUnlock }) {
  const [token, setValue] = useState('')
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const value = token.trim()
    if (!value) return
    setError(null)
    setChecking(true)
    try {
      const res = await fetch('/api/overview', {
        headers: { Authorization: `Bearer ${value}` },
      })
      if (res.ok) {
        setToken(value)
        onUnlock()
      } else {
        setError('Invalid token. Check your AUTH_TOKEN value.')
      }
    } catch {
      setError('Could not reach the backend. Is it running?')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl"
      >
        <h1 className="text-xl font-semibold text-white text-center mb-1">
          Homelab Monitor
        </h1>
        <p className="text-sm text-slate-400 text-center mb-6">
          Enter your access token to continue
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Access token"
          autoFocus
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 mb-4"
        />
        {error && (
          <p className="text-sm text-red-400 mb-4">{error}</p>
        )}
        <button
          type="submit"
          disabled={checking || !token.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
        >
          {checking ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}

function App() {
  const [state, setState] = useState('loading')

  useEffect(() => {
    if (getToken()) {
      setState('ready')
      return
    }
    // No stored token. Probe the backend to see if auth is even enabled.
    let cancelled = false
    fetch('/api/overview')
      .then((res) => {
        if (!cancelled) setState(res.status === 401 ? 'gate' : 'ready')
      })
      .catch(() => {
        if (!cancelled) setState('ready')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = () => setState('gate')
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [])

  if (state === 'gate') return <TokenGate onUnlock={() => setState('ready')} />
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    )
  }
  return <Dashboard />
}

export default App
