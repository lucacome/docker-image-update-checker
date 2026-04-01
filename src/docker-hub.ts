import {ContainerRegistry} from './registry.js'
import {DockerAuth, getRegistryAuth} from './auth.js'
import {buildBasicAuthHeader, fetchToken} from './token-utils.js'
import * as core from '@actions/core'

export class DockerHub extends ContainerRegistry {
  constructor() {
    super('index.docker.io/v2/')
  }
  protected async getToken(repository: string): Promise<string> {
    const auth = this.getCredentials()
    if (!auth) {
      core.info('No credentials found for Docker, using anonymous pull')
    }
    const params = new URLSearchParams({
      service: 'registry.docker.io',
      scope: `repository:${repository}:pull`,
    })
    const headers: Record<string, string> = {}
    if (auth) {
      headers['Authorization'] = buildBasicAuthHeader(auth.username, auth.password)
    }
    return fetchToken(`https://auth.docker.io/token?${params}`, headers, 'Failed to fetch Docker Hub token')
  }

  protected getCredentials(): DockerAuth | undefined {
    return getRegistryAuth('https://index.docker.io/v1/')
  }
}
