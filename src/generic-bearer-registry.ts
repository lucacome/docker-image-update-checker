import * as core from '@actions/core'
import {ContainerRegistry} from './registry.js'
import {DockerAuth, getRegistryAuth} from './auth.js'
import {buildBasicAuthHeader, fetchToken} from './token-utils.js'

export interface BearerRegistryConfig {
  /** Registry API base URL, e.g. `'ghcr.io/v2/'`. */
  baseUrl: string
  /** Token endpoint URL, e.g. `'https://ghcr.io/token'`. */
  tokenUrl: string
  /** Key used to look up credentials in the Docker config file. */
  credentialKey: string
  /**
   * Optional `service` query parameter for the token request.
   * Required by some registries (e.g. Docker Hub, ACR); omit for others (e.g. GHCR).
   */
  service?: string
  /** Human-readable registry name used in log messages. */
  name: string
}

/**
 * Registry client for any registry that follows the standard Docker/OCI Bearer token flow:
 * an optional Basic-auth request to a token endpoint that returns `{"token": "..."}` or
 * `{"access_token": "..."}`, followed by Bearer-authenticated manifest and layer fetches.
 *
 * Subclass this and pass a {@link BearerRegistryConfig} to support a concrete registry.
 * Can also be instantiated directly when no subclass-specific behaviour is needed.
 */
export class GenericBearerRegistry extends ContainerRegistry {
  constructor(private readonly config: BearerRegistryConfig) {
    super(config.baseUrl)
  }

  protected async getToken(repository: string): Promise<string> {
    const auth = this.getCredentials()
    if (!auth) {
      core.info(`No credentials found for ${this.config.name}, using anonymous pull`)
    }
    const params = new URLSearchParams()
    if (this.config.service) {
      params.set('service', this.config.service)
    }
    params.set('scope', `repository:${repository}:pull`)
    const headers: Record<string, string> = {}
    if (auth) {
      headers['Authorization'] = buildBasicAuthHeader(auth.username, auth.password)
    }
    return fetchToken(`${this.config.tokenUrl}?${params}`, headers, `Failed to fetch ${this.config.name} token`)
  }

  protected getCredentials(): DockerAuth | undefined {
    return getRegistryAuth(this.config.credentialKey)
  }
}
