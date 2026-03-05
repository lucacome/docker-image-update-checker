const MAX_ERROR_BODY_LENGTH = 1000

function truncateBody(body: string): string {
  if (body.length > MAX_ERROR_BODY_LENGTH) {
    return body.slice(0, MAX_ERROR_BODY_LENGTH) + '... [truncated]'
  }
  return body
}

export function buildBasicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

export async function fetchToken(url: string, headers: Record<string, string>, errorPrefix: string): Promise<string> {
  const response = await fetch(url, {headers})
  if (!response.ok) {
    let body = ''
    try {
      body = await response.text()
    } catch {
      // ignore body read errors
    }
    const details = body ? ` - ${truncateBody(body)}` : ''
    throw new Error(`${errorPrefix}: ${response.status} ${response.statusText}${details}`)
  }
  const data = (await response.json()) as {token?: string}
  if (!data || typeof data.token !== 'string' || data.token.length === 0) {
    throw new Error(`${errorPrefix}: response did not contain a valid token`)
  }
  return data.token
}
