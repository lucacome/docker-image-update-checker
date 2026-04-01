import {ContainerRegistry} from './registry.js'
import {DockerAuth, getRegistryAuth} from './auth.js'
import {buildBasicAuthHeader, fetchToken} from './token-utils.js'
import * as core from '@actions/core'

export class GitHubContainerRegistry extends ContainerRegistry {
  constructor() {
    super('ghcr.io/v2/')
  }

  protected async getToken(repository: string): Promise<string> {
    const auth = this.getCredentials()
    if (!auth) {
      core.info('No credentials found for GitHub, using anonymous pull')
    }
    const params = new URLSearchParams({scope: `repository:${repository}:pull`})
    const headers: Record<string, string> = {}
    if (auth) {
      headers['Authorization'] = buildBasicAuthHeader(auth.username, auth.password)
    }
    return fetchToken(`https://ghcr.io/token?${params}`, headers, 'Failed to get token from GitHub Container Registry')
  }

  protected getCredentials(): DockerAuth | undefined {
    return getRegistryAuth('ghcr.io')
  }
}
