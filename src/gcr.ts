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
    const data = (await response.json()) as {token: string}
    return data.token
  }

  getCredentials(): DockerAuth | undefined {
    return getRegistryAuth('https://gcr.io/v2/')
  }
}
