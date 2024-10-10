import axios from 'axios'
import {ContainerRegistry} from './registry'
import {DockerAuth, getRegistryAuth} from './auth'
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
    const response = await axios.get('https://auth.docker.io/token', {
      params: {
        service: 'registry.docker.io',
        scope: `repository:${repository}:pull`,
      },
      auth,
    })
    return response.data.token
  }

  getCredentials(): DockerAuth | undefined {
    return getRegistryAuth('https://index.docker.io/v1/')
  }
}
