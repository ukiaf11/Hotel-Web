/**
 * Single API entry point.
 *
 * When `VITE_API_URL` is set the SPA talks to the Django backend over HTTP.
 * Otherwise every call is served by the in-browser demo backend, which implements
 * the same routes — that is how the public demo deployment runs with no server.
 */

import { ApiError } from './errors'
import { demoRequest } from './demo/handlers'

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
export const IS_DEMO = !BASE
export const TOKEN_KEY = 'hotelweb.token'

let accessToken: string | null = null

export const setToken = (token: string | null) => {
  accessToken = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable — keep the token in memory only */
  }
}

export const getToken = () => {
  if (accessToken) return accessToken
  try {
    accessToken = localStorage.getItem(TOKEN_KEY)
  } catch {
    accessToken = null
  }
  return accessToken
}

type Payload = object | null

async function httpRequest<T>(method: string, path: string, body: Payload, wantsBlob: boolean): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.')
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status}).`
    try {
      const data = await response.json()
      detail = data.detail ?? data.message ?? detail
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, detail)
  }

  if (wantsBlob) return (await response.blob()) as T
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

async function request<T>(method: string, path: string, body: Payload = null, wantsBlob = false): Promise<T> {
  if (IS_DEMO) return demoRequest(method, path, (body as Record<string, unknown>) ?? null, getToken()) as Promise<T>
  return httpRequest<T>(method, path, body, wantsBlob)
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: Payload = null) => request<T>('POST', path, body),
  put: <T>(path: string, body: Payload = null) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  blob: (path: string) => request<Blob>('GET', path, null, true),
}
