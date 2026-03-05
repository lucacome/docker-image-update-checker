import {ContainerRegistry} from './registry.js'
import {DockerAuth, getRegistryAuth} from './auth.js'

export class GoogleContainerRegistry extends ContainerRegistry {
  constructor() {
    super('gcr.io/v2/')
  }

  async getToken(repository: string): Promise<string> {
    const auth = this.getCredentials()
    const params = new URLSearchParams({scope: `repository:${repository}:pull`})
    const headers: Record<string, string> = {}
    if (auth) {
      headers['Authorization'] = `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`
    }
    const response = await fetch(`https://gcr.io/token?${params}`, {headers})
    if (!response.ok) {
      let body = ''
      try {
        body = await response.text()
      } catch {
        // ignore body read errors
      }
      const details = body ? ` - ${body}` : ''
      throw new Error(`Failed to obtain GCR token: ${response.status} ${response.statusText || ''}${details}`)
    }
    const data = (await response.json()) as {token?: string}
    if (!data.token || typeof data.token !== 'string' || data.token.length === 0) {
      throw new Error(`GCR token response did not contain a valid 'token' field`)
    }
    return data.token
  }

  getCredentials(): DockerAuth | undefined {
    return getRegistryAuth('https://gcr.io/v2/')
  }
}
