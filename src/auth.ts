import * as core from '@actions/core'
import {Docker} from '@docker/actions-toolkit/lib/docker/docker.js'
import {spawnSync} from 'child_process'

export interface DockerAuth {
  username: string
  password: string
}

/**
 * Resolves Docker credentials for the given registry from the local Docker config file.
 * Tries direct username/password fields first, then a base64-encoded auth field,
 * then the configured credential store helper. Returns undefined if no credentials are found.
 */
export function getRegistryAuth(registry: string): DockerAuth | undefined {
  const config = Docker.configFile()
  if (!config) {
    core.warning('No Docker config found')
  }

  const auths = config?.auths || {}
  const registryAuth = auths[registry]

  if (!registryAuth) {
    core.debug(`No auth entry found for ${registry} in Docker config`)
    return undefined
  }

  if (!registryAuth.username || !registryAuth.password) {
    core.debug(`No username/password fields for ${registry} — falling back to base64-encoded auth field`)
    if (registryAuth.auth) {
      const [user, pass] = Buffer.from(registryAuth.auth, 'base64').toString('utf8').split(':')
      core.debug(`Using base64-encoded auth field credentials for ${registry}`)
      return {username: user, password: pass}
    }
    if (config?.credsStore) {
      core.debug(`No auth field for ${registry} — trying credential store "docker-credential-${config.credsStore}"`)
      const child = spawnSync(`docker-credential-${config.credsStore}`, ['get'], {
        input: `${registry}\n`,
        encoding: 'utf-8',
      })

      if (child.error) {
        throw new Error(`Credential helper docker-credential-${config.credsStore} failed to execute: ${child.error.message}`)
      }

      const creds = child.stdout
      if (creds && child.status === 0) {
        try {
          const {Username, Secret} = JSON.parse(creds)
          core.debug(`Using credentials for ${registry} from credential store "docker-credential-${config.credsStore}"`)
          return {username: Username, password: Secret}
        } catch (e) {
          throw new Error(`Failed to parse credential helper output: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
        }
      }
    }
    core.debug(`No credentials resolved for ${registry} — no auth field and no usable credential store`)
    return undefined
  }

  core.debug(`Using username/password credentials for ${registry}`)
  return {username: registryAuth.username, password: registryAuth.password}
}
