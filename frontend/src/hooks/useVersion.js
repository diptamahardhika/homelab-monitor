import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

// useVersion loads the backend build info once for the footer.
export function useVersion() {
  const [version, setVersion] = useState(null)
  const [commit, setCommit] = useState(null)
  const [commitTime, setCommitTime] = useState(null)

  useEffect(() => {
    apiFetch('/api/version')
      .then(r => r.json())
      .then(d => {
        if (d && d.version) setVersion(d.version)
        if (d && d.commit) setCommit(d.commit)
        if (d && d.commit_time) setCommitTime(d.commit_time)
      })
      .catch(() => {})
  }, [])

  return { version, commit, commitTime }
}
