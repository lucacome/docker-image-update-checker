import * as core from '@actions/core'
import {Docker} from '@docker/actions-toolkit/lib/docker/docker.js'
import {spawnSync} from 'child_process'

export interface DockerAuth {
  username: string
  password: string
}

/**
 * Runs a Docker credential helper binary and returns the parsed credentials,
 * or undefined if the helper reports no credentials for the registry.
 * Throws on execution failure or unparsable output.
 */
function runCredentialHelper(helperName: string, registry: string): DockerAuth | undefined {
  const binary = `docker-credential-${helperName}`
  core.debug(`Trying credential helper "${binary}" for ${registry}`)
  const child = spawnSync(binary, ['get'], {input: `${registry}\n`, encoding: 'utf-8'})

  if (child.error) {
    throw new Error(`Credential helper ${binary} failed to execute: ${child.error.message}`)
  }

  if (!child.stdout || child.status !== 0) {
    return undefined
  }

  try {
    const {Username, Secret} = JSON.parse(child.stdout)
    core.debug(`Using credentials for ${registry} from credential helper "${binary}"`)
    return {username: Username, password: Secret}
  } catch (e) {
    throw new Error(`Failed to parse credential helper output: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
  }
}

/**
 * Resolves Docker credentials for the given registry from the local Docker config file.
 *
 * Resolution order:
 *   1. Direct `username` + `password` fields in `auths[registry]`
 *   2. Base64-encoded `auth` field in `auths[registry]`
 *   3. Per-registry credential helper from `credHelpers[registry]`
 *   4. Global credential store from `credsStore`
 *
 * Returns undefined if no credentials are found by any method.
 */
export function getRegistryAuth(registry: string): DockerAuth | undefined {
  const config = Docker.configFile()
  if (!config) {
    core.warning('No Docker config found')
  }

  const registryAuth = config?.auths?.[registry]

  if (registryAuth?.username && registryAuth?.password) {
    core.debug(`Using username/password credentials for ${registry}`)
    return {username: registryAuth.username, password: registryAuth.password}
  }

  if (registryAuth?.auth) {
    core.debug(`No username/password fields for ${registry} — falling back to base64-encoded auth field`)
    const [user, pass] = Buffer.from(registryAuth.auth, 'base64').toString('utf8').split(':')
    core.debug(`Using base64-encoded auth field credentials for ${registry}`)
    return {username: user, password: pass}
  }

  if (!registryAuth) {
    core.debug(`No auth entry found for ${registry} in Docker config`)
  }

  // Per-registry credential helper (e.g. set by `gcloud auth configure-docker`)
  const credHelper = (config as {credHelpers?: Record<string, string>} | undefined)?.credHelpers?.[registry]
  if (credHelper) {
    const result = runCredentialHelper(credHelper, registry)
    if (result) return result
  }

  // Global credential store (e.g. osxkeychain, secretservice, pass)
  if (config?.credsStore) {
    const result = runCredentialHelper(config.credsStore, registry)
    if (result) return result
  }

  core.debug(`No credentials resolved for ${registry} — tried all available methods`)
  return undefined
}
