const TOKEN_KEY = 'auth_token'
const COOKIE_KEY = 'auth_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function ensureCookie(token) {
  if (document.cookie.includes(`${COOKIE_KEY}=${encodeURIComponent(token)}`)) return
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(token)}; path=/; max-age=31536000; SameSite=Lax`
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
    // Cookie mirrors the token so EventSource (which cannot set headers) can
    // authenticate. Same-site so cross-origin requests don't carry it.
    ensureCookie(token)
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = `${COOKIE_KEY}=; path=/; max-age=0`
}

// apiFetch is fetch with the stored bearer token injected. On a 401 it clears
// the stored token and notifies the app so the token gate can show.
export async function apiFetch(path, opts = {}) {
  const token = getToken()
  const headers = { ...(opts.headers || {}) }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
    ensureCookie(token)
  }
  const res = await fetch(path, { ...opts, headers })
  if (res.status === 401) {
    clearToken()
    window.dispatchEvent(new Event('auth:unauthorized'))
  }
  return res
}
