import {ContainerRegistry} from './registry.js'
import {DockerAuth, getRegistryAuth} from './auth.js'
import {buildBasicAuthHeader, fetchToken} from './token-utils.js'
import * as core from '@actions/core'

export class GoogleContainerRegistry extends ContainerRegistry {
  constructor() {
    super('gcr.io/v2/')
  }

  async getToken(repository: string): Promise<string> {
    const auth = this.getCredentials()
    if (!auth) {
      core.info('No credentials found for GCR, using anonymous pull')
    }
    const params = new URLSearchParams({scope: `repository:${repository}:pull`})
    const headers: Record<string, string> = {}
    if (auth) {
      headers['Authorization'] = buildBasicAuthHeader(auth.username, auth.password)
    }
    return fetchToken(`https://gcr.io/token?${params}`, headers, 'Failed to obtain GCR token')
  }

  getCredentials(): DockerAuth | undefined {
    return getRegistryAuth('https://gcr.io/v2/')
  }
}
