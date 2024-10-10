import * as core from '@actions/core'
import {Docker} from '@docker/actions-toolkit/lib/docker/docker'

export interface DockerAuth {
  username: string
  password: string
}

export function getRegistryAuth(registry: string): DockerAuth | undefined {
  const config = Docker.configFile()
  if (!config) {
    core.warning('No Docker config found')
  }

  const auths = config?.auths || {}
  const registryAuth = auths[registry]

  if (!registryAuth || !registryAuth.auth) {
    core.warning(`No authentication found for registry: ${registry}`)
    return undefined
  }

  return {username: registryAuth.username || '', password: registryAuth.password || ''}
}
