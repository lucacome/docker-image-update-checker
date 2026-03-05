import {ContainerRegistry} from './registry.js'
import {DockerAuth, getRegistryAuth} from './auth.js'
import * as core from '@actions/core'

export class DockerHub extends ContainerRegistry {
  constructor() {
    super('index.docker.io/v2/')
  }
  async getToken(repository: string): Promise<string> {
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
      headers['Authorization'] = `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`
    }
    const response = await fetch(`https://auth.docker.io/token?${params}`, {headers})
    if (!response.ok) {
      let body = ''
      try {
        body = await response.text()
      } catch {
        // ignore body read errors
      }
      const details = body ? ` - ${body}` : ''
      throw new Error(`Failed to fetch Docker Hub token: ${response.status} ${response.statusText}${details}`)
    }
    const data = (await response.json()) as {token?: string}
    if (!data || typeof data.token !== 'string' || data.token.length === 0) {
      throw new Error('Docker Hub token response did not contain a valid token')
    }
    return data.token
  }

  getCredentials(): DockerAuth | undefined {
    return getRegistryAuth('https://index.docker.io/v1/')
  }
}
