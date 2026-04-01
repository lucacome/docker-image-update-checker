import {jest} from '@jest/globals'

/**
 * Builds a mock Response object that satisfies both:
 * - registry.ts: uses response.json() and response.headers.entries()
 * - token-utils.ts: uses response.text() and response.headers.get()
 */
export function mockResponse(body: unknown, headers: Record<string, string> = {}): Response {
  const headersMap: Record<string, string> = {
    'content-type': 'application/json',
    ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
  }
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: (name: string) => headersMap[name.toLowerCase()] ?? null,
      entries: () => Object.entries(headersMap)[Symbol.iterator](),
    },
    // When body is passed as a string it must be valid JSON; JSON.parse will throw at
    // mock-construction time otherwise. All current test fixtures pass objects, not strings.
    json: (jest.fn() as jest.MockedFunction<() => Promise<unknown>>).mockResolvedValue(typeof body === 'string' ? JSON.parse(body) : body),
    text: (jest.fn() as jest.MockedFunction<() => Promise<string>>).mockResolvedValue(bodyStr),
  } as unknown as Response
}
