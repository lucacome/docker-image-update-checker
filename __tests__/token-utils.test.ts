import {jest, describe, test, expect, afterEach} from '@jest/globals'
import {fetchToken, buildBasicAuthHeader} from '../src/token-utils.js'

function makeFetchResponse(options: {ok: boolean; status: number; statusText?: string; body?: string; contentType?: string}): Response {
  const headers = new Headers()
  if (options.contentType) {
    headers.set('content-type', options.contentType)
  }
  return {
    ok: options.ok,
    status: options.status,
    statusText: options.statusText ?? '',
    headers,
    text: jest.fn().mockResolvedValue(options.body ?? ''),
  } as unknown as Response
}

describe('buildBasicAuthHeader', () => {
  test('encodes credentials as Basic auth header', () => {
    const header = buildBasicAuthHeader('user', 'pass')
    expect(header).toBe(`Basic ${Buffer.from('user:pass').toString('base64')}`)
  })
})

describe('fetchToken', () => {
  const url = 'https://auth.example.com/token'
  const headers = {Authorization: 'Basic dXNlcjpwYXNz'}
  const errorPrefix = 'TestRegistry token'

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('returns token on successful response', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      makeFetchResponse({
        ok: true,
        status: 200,
        body: JSON.stringify({token: 'my-jwt-token'}),
        contentType: 'application/json',
      }),
    )
    jest.spyOn(globalThis, 'fetch').mockImplementation(mockFetch)

    const token = await fetchToken(url, headers, errorPrefix)
    expect(token).toBe('my-jwt-token')
  })

  test('throws with status and body on non-2xx response', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      makeFetchResponse({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        body: 'Unauthorized access',
      }),
    )
    jest.spyOn(globalThis, 'fetch').mockImplementation(mockFetch)

    await expect(fetchToken(url, headers, errorPrefix)).rejects.toThrow(`${errorPrefix}: 401 Unauthorized - Unauthorized access`)
  })

  test('truncates long error body on non-2xx response', async () => {
    const longBody = 'x'.repeat(1500)
    const mockFetch = jest.fn().mockResolvedValue(
      makeFetchResponse({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        body: longBody,
      }),
    )
    jest.spyOn(globalThis, 'fetch').mockImplementation(mockFetch)

    await expect(fetchToken(url, headers, errorPrefix)).rejects.toThrow('... [truncated]')
  })

  test('throws on invalid JSON response body', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      makeFetchResponse({
        ok: true,
        status: 200,
        body: 'not-valid-json',
        contentType: 'text/html',
      }),
    )
    jest.spyOn(globalThis, 'fetch').mockImplementation(mockFetch)

    await expect(fetchToken(url, headers, errorPrefix)).rejects.toThrow(`${errorPrefix}: failed to parse JSON response`)
  })

  test('includes raw body in JSON parse error', async () => {
    const badBody = '<html>Error</html>'
    const mockFetch = jest.fn().mockResolvedValue(
      makeFetchResponse({
        ok: true,
        status: 200,
        body: badBody,
        contentType: 'text/html',
      }),
    )
    jest.spyOn(globalThis, 'fetch').mockImplementation(mockFetch)

    await expect(fetchToken(url, headers, errorPrefix)).rejects.toThrow(badBody)
  })

  test('throws when token field is missing from response', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      makeFetchResponse({
        ok: true,
        status: 200,
        body: JSON.stringify({access_token: 'some-value'}),
        contentType: 'application/json',
      }),
    )
    jest.spyOn(globalThis, 'fetch').mockImplementation(mockFetch)

    await expect(fetchToken(url, headers, errorPrefix)).rejects.toThrow(`${errorPrefix}: response did not contain a valid token`)
  })

  test('throws when token field is empty string', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      makeFetchResponse({
        ok: true,
        status: 200,
        body: JSON.stringify({token: ''}),
        contentType: 'application/json',
      }),
    )
    jest.spyOn(globalThis, 'fetch').mockImplementation(mockFetch)

    await expect(fetchToken(url, headers, errorPrefix)).rejects.toThrow(`${errorPrefix}: response did not contain a valid token`)
  })
})
