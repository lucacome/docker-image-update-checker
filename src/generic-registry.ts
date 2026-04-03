import * as core from '@actions/core'
import {ContainerRegistry} from './registry.js'
import {DockerAuth, getRegistryAuth} from './auth.js'
import {buildBasicAuthHeader, fetchToken} from './token-utils.js'

/**
 * Static Bearer token configuration for registries whose token endpoint is already known.
 * When provided to {@link GenericRegistry}, the `/v2/` discovery probe is skipped entirely.
 */
export interface StaticBearerConfig {
  /**
   * Token endpoint URL — equivalent to the `realm` field in a `WWW-Authenticate: Bearer` header.
   * Example: `'https://auth.docker.io/token'`
   */
  realm: string
  /**
   * Optional `service` query parameter for the token request.
   * Required by some registries (e.g. Docker Hub, ACR); omit for others (e.g. GHCR).
   */
  service?: string
  /**
   * Key used to look up credentials in the Docker config file
   * (what `docker login <key>` writes). Defaults to the registry hostname.
   */
  credentialKey?: string
  /** Human-readable registry name used in log messages. Defaults to the registry hostname. */
  name?: string
}

/**
 * Parses the `WWW-Authenticate` header value for a `Bearer` challenge.
 * Returns `null` if the scheme is not `Bearer` or the `realm` parameter is absent.
 * Accepts both quoted-string and unquoted token forms for each parameter per RFC 7235.
 *
 * Example header values:
 *   Bearer realm="https://auth.example.com/token",service="registry.example.com"
 *   Bearer realm=https://auth.example.com/token,service=registry.example.com
 */
function parseBearerChallenge(header: string): {realm: string; service?: string} | null {
  if (!header.toLowerCase().startsWith('bearer ')) return null
  const params = header.slice('bearer '.length)
  const realmMatch = params.match(/realm="([^"]+)"|realm=([^",\s]+)/i)
  const realm = (realmMatch?.[1] ?? realmMatch?.[2])?.trim()
  if (!realm) return null
  const serviceMatch = params.match(/service="([^"]+)"|service=([^",\s]+)/i)
  const service = (serviceMatch?.[1] ?? serviceMatch?.[2])?.trim()
  return {realm, service}
}

/**
 * Registry client that works for any OCI/Docker-compliant registry.
 *
 * **Static mode** — pass a {@link StaticBearerConfig} as the second argument.
 * The token endpoint is used directly with no `/v2/` probe. Use this for registries
 * whose endpoints are well-known (Docker Hub, GHCR, Quay, ACR, GAR, ECR …).
 *
 * **Discovery mode** — omit the second argument.
 * On the first `getToken()` call the class probes `https://<hostname>/v2/` and reads the
 * `WWW-Authenticate` header from the 401 response to discover the token endpoint and
 * optional `service` parameter. The result is cached so the probe fires at most once per
 * instance, even under concurrent calls. If the registry returns 200 (truly open), issues
 * a non-Bearer challenge, or the probe fails, `getToken()` returns `''` so the base class
 * sends unauthenticated requests — correct for fully open registries.
 *
 * In both modes credentials are looked up from the Docker config via `credentialKey`
 * (defaults to `hostname`) and sent as HTTP Basic auth to the token endpoint when present.
 */
export class GenericRegistry extends ContainerRegistry {
  private readonly credentialKey: string
  private readonly displayName: string

  // Discovery state — only used when no staticConfig is provided
  private discoveryPromise?: Promise<void>
  private challenge: {realm: string; service?: string} | null = null

  constructor(
    private readonly hostname: string,
    staticConfig?: StaticBearerConfig,
  ) {
    super(`${hostname}/v2/`)
    this.credentialKey = staticConfig?.credentialKey ?? hostname
    this.displayName = staticConfig?.name ?? hostname
    if (staticConfig) {
      this.challenge = {realm: staticConfig.realm, service: staticConfig.service}
      // Mark discovery as already complete so doDiscover() is never called
      this.discoveryPromise = Promise.resolve()
    }
  }

  /** Ensures the `/v2/` probe has run exactly once. No-op in static mode. */
  private discover(): Promise<void> {
    if (!this.discoveryPromise) {
      this.discoveryPromise = this.doDiscover()
    }
    return this.discoveryPromise
  }

  private async doDiscover(): Promise<void> {
    const url = `https://${this.hostname}/v2/`
    core.debug(`GenericRegistry: probing ${url} for WWW-Authenticate header`)
    let response: Response
    try {
      // Call globalThis.fetch directly (not this.fetch()) so a 401 does not throw —
      // we need to read the WWW-Authenticate header from the error response.
      response = await globalThis.fetch(url, {signal: AbortSignal.timeout(10_000)})
    } catch (e) {
      if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        core.warning(`GenericRegistry: timed out probing ${url} after 10s`)
      } else {
        core.warning(`GenericRegistry: failed to probe ${url}: ${e instanceof Error ? e.message : String(e)}`)
      }
      return
    }

    try {
      if (response.status === 200) {
        core.debug(`GenericRegistry: ${url} returned 200 — treating as fully open (no token needed)`)
        return
      }

      const wwwAuth = response.headers.get('www-authenticate')
      if (!wwwAuth) {
        core.debug(`GenericRegistry: no WWW-Authenticate header from ${url} (status ${response.status})`)
        return
      }

      const parsed = parseBearerChallenge(wwwAuth)
      if (!parsed) {
        core.debug(`GenericRegistry: non-Bearer WWW-Authenticate from ${url}: ${wwwAuth}`)
        return
      }

      core.debug(`GenericRegistry: discovered Bearer realm="${parsed.realm}" service="${parsed.service ?? '(none)'}"`)
      this.challenge = parsed
    } finally {
      await response.body?.cancel()
    }
  }

  protected async getToken(repository: string): Promise<string> {
    await this.discover()

    if (!this.challenge) {
      // No Bearer challenge found — return empty string for anonymous / open access
      return ''
    }

    const auth = this.getCredentials()
    if (auth) {
      core.debug(`Fetching token for ${this.displayName} with HTTP Basic auth`)
    } else {
      core.info(`No credentials found for ${this.displayName}, using anonymous pull`)
    }

    const tokenUrlObj = new URL(this.challenge.realm)
    if (this.challenge.service) {
      tokenUrlObj.searchParams.set('service', this.challenge.service)
    }
    tokenUrlObj.searchParams.set('scope', `repository:${repository}:pull`)
    const tokenUrl = tokenUrlObj.toString()

    const headers: Record<string, string> = {}
    if (auth) {
      headers['Authorization'] = buildBasicAuthHeader(auth.username, auth.password)
    }

    return fetchToken(tokenUrl, headers, `Failed to fetch token for ${this.displayName} from ${tokenUrl}`)
  }

  protected getCredentials(): DockerAuth | undefined {
    return getRegistryAuth(this.credentialKey)
  }
}
