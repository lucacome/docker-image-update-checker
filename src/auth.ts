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
  core.info(`auths: ${JSON.stringify(auths)}`)
  const registryAuth = auths[registry]

  core.info(`${JSON.stringify(registryAuth)}`)

  if (!registryAuth || !registryAuth.username || !registryAuth.password) {
    core.warning(`No credentials found for ${registry}`)
    return undefined
  }

  return {username: registryAuth.username, password: registryAuth.password}
}
