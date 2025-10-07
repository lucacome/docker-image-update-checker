import {ContainerRegistry} from './registry.js'
import axios from 'axios'
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
    const response = await axios.get(`https://ghcr.io/token`, {
      params: {
        scope: `repository:${repository}:pull`,
      },
      auth,
    })
    // check if the call was successful
    if (response.status !== 200) {
      core.info(response.data)
      throw new Error(`Failed to get token from GitHub Container Registry: ${response.status}`)
    }
    return response.data.token
  }

  getCredentials(): DockerAuth | undefined {
    return getRegistryAuth('ghcr.io')
  }
}
