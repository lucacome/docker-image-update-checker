import {ContainerRegistry} from './registry'
import axios from 'axios'
import {DockerAuth, getRegistryAuth} from './auth'

export class GoogleContainerRegistry extends ContainerRegistry {
  constructor() {
    super('gcr.io/v2/')
  }

  async getToken(repository: string): Promise<string> {
    const auth = this.getCredentials()
    const response = await axios.get('https://gcr.io/token', {
      params: {
        scope: `repository:${repository}:pull`,
      },
      auth,
    })
    return response.data.token
  }

  getCredentials(): DockerAuth | undefined {
    return getRegistryAuth('https://gcr.io/v2/')
  }
}
