const TOKEN_KEY = 'auth_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// apiFetch is fetch with the stored bearer token injected. On a 401 it clears
// the stored token and notifies the app so the token gate can show.
export async function apiFetch(path, opts = {}) {
  const token = getToken()
  const headers = { ...(opts.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { ...opts, headers })
  if (res.status === 401) {
    clearToken()
    window.dispatchEvent(new Event('auth:unauthorized'))
  }
  return res
}
