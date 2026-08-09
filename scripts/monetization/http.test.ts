import assert from 'node:assert/strict'
import test from 'node:test'

import { requestJson } from './http'

test('uses exponential backoff when a retryable response omits Retry-After', async () => {
  const originalFetch = globalThis.fetch
  const originalSetTimeout = globalThis.setTimeout
  const delays: number[] = []
  let requests = 0

  globalThis.fetch = async () => {
    requests += 1
    return requests === 1 ? new Response('', { status: 500 }) : Response.json({ ok: true })
  }
  globalThis.setTimeout = ((callback: () => void, milliseconds?: number) => {
    delays.push(milliseconds ?? 0)
    callback()
    return 0 as unknown as NodeJS.Timeout
  }) as typeof setTimeout

  try {
    assert.deepEqual(await requestJson<{ ok: boolean }>('https://example.test'), { ok: true })
    assert.deepEqual(delays, [1000])
  } finally {
    globalThis.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
  }
})
