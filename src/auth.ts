import * as core from '@actions/core'
import {Docker} from '@docker/actions-toolkit/lib/docker/docker'
import {spawnSync} from 'child_process'

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

  if (!registryAuth) {
    core.warning(`No credentials found for ${registry}`)
    return undefined
  }

  if (!registryAuth.username || !registryAuth.password) {
    core.debug(`No username or password found for ${registry}, trying auth field`)
    if (registryAuth.auth) {
      const [user, pass] = Buffer.from(registryAuth.auth, 'base64').toString('utf8').split(':')
      return {username: user, password: pass}
    }
    if (config?.credsStore) {
      core.debug('No auth field, using credential store to get credentials')
      const child = spawnSync(`docker-credential-${config.credsStore}`, ['get'], {
        input: `\n${registry}\n`,
        encoding: 'utf-8',
      })

      if (child.error) {
        console.error('Error executing command:', child.error)
      }

      const creds = child.stdout
      if (creds) {
        const {Username, Secret} = JSON.parse(creds)
        return {username: Username, password: Secret}
      }
    }
    core.debug('No credentials found, returning undefined')
    return undefined
  }

  return {username: registryAuth.username, password: registryAuth.password}
}
