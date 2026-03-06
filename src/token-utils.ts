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
  let response: Response
  try {
    response = await fetch(url, {headers})
  } catch (e) {
    throw new Error(`${errorPrefix}: network error - ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!response.ok) {
    let body = ''
    try {
      body = await response.text()
    } catch {
      // ignore body read errors on error responses
    }
    const details = body ? ` - ${truncateBody(body)}` : ''
    throw new Error(`${errorPrefix}: ${response.status} ${response.statusText}${details}`)
  }
  let body: string
  try {
    body = await response.text()
  } catch (e) {
    throw new Error(
      `${errorPrefix}: failed to read response body (status: ${response.status}): ${e instanceof Error ? e.message : String(e)}`,
    )
  }
  let data: {token?: string}
  try {
    data = JSON.parse(body) as {token?: string}
  } catch (e) {
    const details = body ? ` - ${truncateBody(body)}` : ''
    throw new Error(
      `${errorPrefix}: failed to parse JSON response (status: ${response.status}, content-type: ${response.headers.get('content-type')}${details}): ${e instanceof Error ? e.message : String(e)}`,
    )
  }
  if (!data || typeof data.token !== 'string' || data.token.length === 0) {
    throw new Error(`${errorPrefix}: response did not contain a valid token`)
  }
  return data.token
}
