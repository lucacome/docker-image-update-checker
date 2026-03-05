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
      let body = ''
      try {
        body = await response.text()
      } catch {
        // ignore body read errors
      }
      const details = body ? ` - ${body}` : ''
      throw new Error(`Failed to get token from GitHub Container Registry: ${response.status} ${response.statusText}${details}`)
    }
    const data = (await response.json()) as {token?: string}
    if (!data || typeof data.token !== 'string' || data.token.length === 0) {
      throw new Error('GitHub Container Registry token response did not contain a valid token')
    }
    return data.token
  }

  getCredentials(): DockerAuth | undefined {
    return getRegistryAuth('ghcr.io')
  }
}
