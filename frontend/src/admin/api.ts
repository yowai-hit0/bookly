import { env } from '@/env'
import { clearSession, readSession } from './session'

/** The API's own error code, e.g. `invalid_request`, with the HTTP status. */
export class ApiError extends Error {
  override readonly name: string = 'ApiError'
  readonly status: number

  constructor(status: number, code: string) {
    super(code)
    this.status = status
  }
}

/** No token, or the API refused it. The caller sends him to sign in. */
export class UnauthenticatedError extends ApiError {
  override readonly name = 'UnauthenticatedError'

  constructor() {
    super(401, 'unauthenticated')
  }
}

export function apiUrl(path: string): string {
  return `${env.VITE_API_BASE_URL}${path}`
}

/**
 * A JSON request to an admin endpoint, carrying `Authorization: Bearer`.
 *
 * The header is the only place the token travels -- never a cookie or the
 * query string (plan.md Task 7). A 401 means the token expired or the password
 * changed, so the stored session is dropped rather than retried.
 */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = readSession()
  if (session === null) throw new UnauthenticatedError()

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${session.token}`)
  headers.set('Accept', 'application/json')

  const res = await fetch(apiUrl(path), { ...init, headers })
  if (res.status === 401) {
    clearSession()
    throw new UnauthenticatedError()
  }
  if (!res.ok) throw new ApiError(res.status, await errorCode(res))
  return (await res.json()) as T
}

async function errorCode(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : `http_${res.status}`
  } catch {
    return `http_${res.status}`
  }
}
