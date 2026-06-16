import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classify, pickMessage } from './http'
import type { HttpErrorCode } from './httpErrorMessages'
import { HTTP_ERROR_FALLBACKS } from './httpErrorMessages'

// --- classify() ---

describe('classify', () => {
  it('returns NETWORK when no response exists (network failure)', () => {
    const error = { response: undefined }
    expect(classify(error)).toEqual({ code: 'NETWORK', retryable: true })
  })

  it('returns GATEWAY_UNAVAILABLE for 502', () => {
    const error = { response: { status: 502, data: '<html>Bad Gateway</html>' } }
    expect(classify(error)).toEqual({ code: 'GATEWAY_UNAVAILABLE', retryable: true })
  })

  it('returns GATEWAY_UNAVAILABLE for 503', () => {
    const error = { response: { status: 503, data: '' } }
    expect(classify(error)).toEqual({ code: 'GATEWAY_UNAVAILABLE', retryable: true })
  })

  it('returns GATEWAY_UNAVAILABLE for 504', () => {
    const error = { response: { status: 504, data: null } }
    expect(classify(error)).toEqual({ code: 'GATEWAY_UNAVAILABLE', retryable: true })
  })

  it('returns UNAUTHORIZED for 401', () => {
    const error = { response: { status: 401, data: {} } }
    expect(classify(error)).toEqual({ code: 'UNAUTHORIZED', retryable: false })
  })

  it('returns FORBIDDEN for 403', () => {
    const error = { response: { status: 403, data: { message: 'scope check failed' } } }
    expect(classify(error)).toEqual({ code: 'FORBIDDEN', retryable: false })
  })

  it('returns NOT_FOUND for 404', () => {
    const error = { response: { status: 404, data: { message: 'not found' } } }
    expect(classify(error)).toEqual({ code: 'NOT_FOUND', retryable: false })
  })

  it('returns CONFLICT for 409', () => {
    const error = { response: { status: 409, data: { message: 'conflict' } } }
    expect(classify(error)).toEqual({ code: 'CONFLICT', retryable: false })
  })

  it('returns INVALID_INPUT for 400', () => {
    const error = { response: { status: 400, data: { message: 'bad request' } } }
    expect(classify(error)).toEqual({ code: 'INVALID_INPUT', retryable: false })
  })

  it('returns INVALID_INPUT for 422', () => {
    const error = { response: { status: 422, data: { message: 'validation' } } }
    expect(classify(error)).toEqual({ code: 'INVALID_INPUT', retryable: false })
  })

  it('returns TOO_MANY_REQUESTS for 429', () => {
    const error = { response: { status: 429, data: {} } }
    expect(classify(error)).toEqual({ code: 'TOO_MANY_REQUESTS', retryable: true })
  })

  it('returns BACKEND_ERROR for 500 with JSON body containing message', () => {
    const error = { response: { status: 500, data: { message: 'db error' } } }
    expect(classify(error)).toEqual({ code: 'BACKEND_ERROR', retryable: false })
  })

  it('returns GATEWAY_UNAVAILABLE for 502 even with JSON body but no backend code', () => {
    // 502 is always gateway — even if body happens to be JSON
    const error = { response: { status: 502, data: { message: 'upstream timeout' } } }
    expect(classify(error)).toEqual({ code: 'GATEWAY_UNAVAILABLE', retryable: true })
  })

  it('prefers backend code field over status-based classification', () => {
    // Backend sends GATEWAY_UNAVAILABLE (mapped from errcode.UpstreamUnavailable)
    const error = { response: { status: 502, data: { code: 'GATEWAY_UNAVAILABLE', message: 'CF org list failed: connection refused' } } }
    expect(classify(error)).toEqual({ code: 'GATEWAY_UNAVAILABLE', retryable: true })
  })

  it('recognizes backend BACKEND_ERROR code on 500', () => {
    // Backend sends BACKEND_ERROR (mapped from errcode.Internal)
    const error = { response: { status: 500, data: { code: 'BACKEND_ERROR', message: 'failed to get integration configs: db timeout' } } }
    expect(classify(error)).toEqual({ code: 'BACKEND_ERROR', retryable: false })
  })

  it('ignores unknown backend code and falls back to status', () => {
    const error = { response: { status: 400, data: { code: 'BOGUS_CODE', message: 'bad' } } }
    expect(classify(error)).toEqual({ code: 'INVALID_INPUT', retryable: false })
  })

  it('returns UNKNOWN for unrecognized status without message', () => {
    const error = { response: { status: 418, data: null } }
    expect(classify(error)).toEqual({ code: 'UNKNOWN', retryable: false })
  })
})

// --- pickMessage() ---

describe('pickMessage', () => {
  it('returns backend message when response data is JSON with message field', () => {
    const error = { response: { data: { message: 'failed to get configs: db timeout' } } }
    expect(pickMessage(error, 'BACKEND_ERROR')).toBe('failed to get configs: db timeout')
  })

  it('returns fallback when response data is HTML string (approuter 5xx)', () => {
    const error = { response: { data: '<html><body>Bad Gateway</body></html>' } }
    expect(pickMessage(error, 'GATEWAY_UNAVAILABLE')).toBe(HTTP_ERROR_FALLBACKS.GATEWAY_UNAVAILABLE)
  })

  it('returns fallback when response data is null', () => {
    const error = { response: { data: null } }
    expect(pickMessage(error, 'NETWORK')).toBe(HTTP_ERROR_FALLBACKS.NETWORK)
  })

  it('returns fallback when response data is empty object without message', () => {
    const error = { response: { data: {} } }
    expect(pickMessage(error, 'GATEWAY_UNAVAILABLE')).toBe(HTTP_ERROR_FALLBACKS.GATEWAY_UNAVAILABLE)
  })

  it('returns fallback when response is undefined (network error)', () => {
    const error = {}
    expect(pickMessage(error, 'NETWORK')).toBe(HTTP_ERROR_FALLBACKS.NETWORK)
  })
})

// --- dedupedToastError ---

describe('dedupedToastError', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as any).window = { $toast: { error: vi.fn() } }
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (globalThis as any).window
  })

  it('fires toast on first call', async () => {
    const { dedupedToastError } = await import('./toastDedupe')
    dedupedToastError('key1', 'msg1')
    expect(window.$toast!.error).toHaveBeenCalledWith('msg1')
    expect(window.$toast!.error).toHaveBeenCalledTimes(1)
  })

  it('suppresses duplicate within 1500ms window', async () => {
    vi.resetModules()
    const { dedupedToastError } = await import('./toastDedupe')
    dedupedToastError('key1', 'msg1')
    dedupedToastError('key1', 'msg1')
    dedupedToastError('key1', 'msg1')
    expect(window.$toast!.error).toHaveBeenCalledTimes(1)
  })

  it('allows same key after window expires', async () => {
    vi.resetModules()
    const { dedupedToastError } = await import('./toastDedupe')
    dedupedToastError('key1', 'msg1')
    vi.advanceTimersByTime(1600)
    dedupedToastError('key1', 'msg1')
    expect(window.$toast!.error).toHaveBeenCalledTimes(2)
  })

  it('allows different keys simultaneously', async () => {
    vi.resetModules()
    const { dedupedToastError } = await import('./toastDedupe')
    dedupedToastError('key1', 'msg1')
    dedupedToastError('key2', 'msg2')
    dedupedToastError('key3', 'msg3')
    expect(window.$toast!.error).toHaveBeenCalledTimes(3)
  })
})
