import {ContainerRegistry} from './registry.js'
import {DockerAuth, getRegistryAuth} from './auth.js'
import {buildBasicAuthHeader, fetchToken} from './token-utils.js'
import * as core from '@actions/core'

export class DockerHardenedImages extends ContainerRegistry {
  constructor() {
    super('dhi.io/v2/')
  }

  async getToken(repository: string): Promise<string> {
    const auth = this.getCredentials()
    if (!auth) {
      core.info('No credentials found for dhi.io, using anonymous pull')
    }
    const params = new URLSearchParams({
      service: 'dhi.io',
      scope: `repository:${repository}:pull`,
    })
    const headers: Record<string, string> = {}
    if (auth) {
      headers['Authorization'] = buildBasicAuthHeader(auth.username, auth.password)
    }
    return fetchToken(`https://auth.docker.io/token?${params}`, headers, 'Failed to fetch dhi.io token')
  }

  getCredentials(): DockerAuth | undefined {
    return getRegistryAuth('dhi.io')
  }
}
