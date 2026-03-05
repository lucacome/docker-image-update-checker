import {ContainerRegistry} from './registry.js'
import {DockerAuth, getRegistryAuth} from './auth.js'
import * as core from '@actions/core'

export class GitHubContainerRegistry extends ContainerRegistry {
  constructor() {
    super('ghcr.io/v2/')
  }

  async getToken(repository: string): Promise<string> {
    const auth = this.getCredentials()
    if (!auth) {
      core.info('No credentials found for GitHub, using anonymous pull')
    }
    const params = new URLSearchParams({scope: `repository:${repository}:pull`})
    const headers: Record<string, string> = {}
    if (auth) {
      headers['Authorization'] = `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`
    }
    const response = await fetch(`https://ghcr.io/token?${params}`, {headers})
    if (!response.ok) {
      throw new Error(`Failed to get token from GitHub Container Registry: ${response.status}`)
    }
    const data = (await response.json()) as {token: string}
    return data.token
  }

  getCredentials(): DockerAuth | undefined {
    return getRegistryAuth('ghcr.io')
  }
}
