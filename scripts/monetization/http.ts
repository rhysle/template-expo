export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly responseBody: string
  ) {
    super(`HTTP ${status} from ${url}: ${responseBody || 'empty response'}`)
  }
}

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

export interface JsonRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  allowNotFound?: boolean
  retries?: number
}

export type JsonRequester = <T>(url: string, options?: JsonRequestOptions) => Promise<T | undefined>

export interface BytesRequestOptions {
  method: string
  headers?: Record<string, string>
  body: Uint8Array
  retries?: number
}

export const requestJson = async <T>(
  url: string,
  options: JsonRequestOptions = {}
): Promise<T | undefined> => {
  const { method = 'GET', headers = {}, body, allowNotFound = false, retries = 3 } = options

  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (response.status === 404 && allowNotFound) return undefined

    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      const retryAfter = Number(response.headers.get('retry-after'))
      const waitMilliseconds = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : Math.min(1000 * 2 ** attempt, 8000)
      await response.arrayBuffer()
      await delay(waitMilliseconds)
      continue
    }

    const text = await response.text()
    if (!response.ok) throw new ApiError(response.status, url, text)
    if (!text) return undefined
    return JSON.parse(text) as T
  }
}

export const requestBytes = async (url: string, options: BytesRequestOptions): Promise<void> => {
  const { method, headers = {}, body, retries = 3 } = options

  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, { method, headers, body })

    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      const retryAfter = Number(response.headers.get('retry-after'))
      const waitMilliseconds = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : Math.min(1000 * 2 ** attempt, 8000)
      await response.arrayBuffer()
      await delay(waitMilliseconds)
      continue
    }

    const text = await response.text()
    if (!response.ok) throw new ApiError(response.status, url, text)
    return
  }
}

export const appendQuery = (
  url: string,
  query: Record<string, string | number | boolean | undefined>
): string => {
  const parsed = new URL(url)
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) parsed.searchParams.set(key, String(value))
  }
  return parsed.toString()
}
