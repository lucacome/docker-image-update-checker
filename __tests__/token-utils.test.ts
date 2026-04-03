import {jest, describe, it, expect, beforeEach} from '@jest/globals'
import {buildBasicAuthHeader, fetchToken} from '../src/token-utils.js'

function mockResponse(opts: {
  ok: boolean
  status: number
  statusText?: string
  body?: string
  contentType?: string
  textThrows?: boolean
}): Response {
  const {ok, status, statusText = '', body = '', contentType = 'application/json', textThrows = false} = opts
  return {
    ok,
    status,
    statusText,
    headers: {get: (name: string) => (name === 'content-type' ? contentType : null)},
    text: textThrows
      ? jest.fn<() => Promise<string>>().mockRejectedValue(new Error('network read error'))
      : jest.fn<() => Promise<string>>().mockResolvedValue(body),
  } as unknown as Response
}

describe('buildBasicAuthHeader', () => {
  it('encodes credentials as base64 Basic auth', () => {
    expect(buildBasicAuthHeader('user', 'pass')).toBe(`Basic ${Buffer.from('user:pass').toString('base64')}`)
  })

  it('handles empty password', () => {
    expect(buildBasicAuthHeader('user', '')).toBe(`Basic ${Buffer.from('user:').toString('base64')}`)
  })

  it('handles special characters in credentials', () => {
    const user = 'user@example.com'
    const pass = 'p@ss:w0rd!'
    expect(buildBasicAuthHeader(user, pass)).toBe(`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`)
  })
})

describe('fetchToken', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
  })

  it('returns token on successful response', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: true, status: 200, body: JSON.stringify({token: 'mytoken'})}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).resolves.toBe('mytoken')
  })

  it('passes url and headers to fetch', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: true, status: 200, body: JSON.stringify({token: 'tok'})}))
    await fetchToken('https://example.com/token', {Authorization: 'Bearer xyz'}, 'prefix')
    expect(fetch).toHaveBeenCalledWith('https://example.com/token', {headers: {Authorization: 'Bearer xyz'}})
  })

  it('throws with status and body on non-ok response', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: false, status: 401, statusText: 'Unauthorized', body: 'bad credentials'}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow('prefix: 401 Unauthorized - bad credentials')
  })

  it('throws without body details when non-ok response has empty body', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: false, status: 403, statusText: 'Forbidden', body: ''}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow('prefix: 403 Forbidden')
  })

  it('throws without body details when body read fails on non-ok response', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: false, status: 500, statusText: 'Internal Server Error', textThrows: true}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow('prefix: 500 Internal Server Error')
  })

  it('throws on invalid JSON with body included in message', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: true, status: 200, body: '<html>not json</html>', contentType: 'text/html'}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow(
      'prefix: failed to parse JSON response (status: 200, content-type: text/html - <html>not json</html>)',
    )
  })

  it('throws network error with prefix when fetch rejects', async () => {
    jest.mocked(fetch).mockRejectedValue(new Error('getaddrinfo ENOTFOUND example.com'))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow(
      'prefix: network error - getaddrinfo ENOTFOUND example.com',
    )
  })

  it('throws body-read error with context when 2xx body read fails', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: true, status: 200, textThrows: true}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow(
      'prefix: failed to read response body (status: 200): network read error',
    )
  })

  it('throws when neither token nor access_token field is present', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: true, status: 200, body: JSON.stringify({other: 'field'})}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow('prefix: response did not contain a valid token')
  })

  it('throws when token is an empty string', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: true, status: 200, body: JSON.stringify({token: ''})}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow('prefix: response did not contain a valid token')
  })

  it('throws when token is not a string', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: true, status: 200, body: JSON.stringify({token: 42})}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow('prefix: response did not contain a valid token')
  })

  it('throws when token is null', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: true, status: 200, body: JSON.stringify({token: null})}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow('prefix: response did not contain a valid token')
  })

  // Distribution spec: "we will also accept `token` under the name `access_token`"
  it('returns access_token when token field is absent (OAuth2 compatibility)', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: true, status: 200, body: JSON.stringify({access_token: 'oauth2token'})}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).resolves.toBe('oauth2token')
  })

  it('prefers token over access_token when both are present', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValue(mockResponse({ok: true, status: 200, body: JSON.stringify({token: 'primarytoken', access_token: 'oauthtoken'})}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).resolves.toBe('primarytoken')
  })

  it('falls back to access_token when token field is an empty string', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: true, status: 200, body: JSON.stringify({token: '', access_token: 'valid'})}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).resolves.toBe('valid')
  })

  it('throws when access_token is an empty string', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: true, status: 200, body: JSON.stringify({access_token: ''})}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow('prefix: response did not contain a valid token')
  })

  it('throws when JSON response is null (JSON.parse("null") edge case)', async () => {
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: true, status: 200, body: 'null'}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow('prefix: response did not contain a valid token')
  })

  it('truncates long error body', async () => {
    const longBody = 'x'.repeat(1500)
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: false, status: 500, statusText: 'Error', body: longBody}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow('... [truncated]')
  })

  it('does not truncate body within limit', async () => {
    const shortBody = 'x'.repeat(999)
    jest.mocked(fetch).mockResolvedValue(mockResponse({ok: false, status: 500, statusText: 'Error', body: shortBody}))
    await expect(fetchToken('https://example.com/token', {}, 'prefix')).rejects.toThrow(shortBody)
  })
})
