import fs from 'fs'
import * as core from '@actions/core'
import * as path from 'path'
import * as os from 'os'

interface DockerConfig {
  auths: Record<string, {auth: string}>
}

const readDockerConfig = (): DockerConfig => {
  const dirPath = process.env.DOCKER_CONFIG || path.join(os.homedir(), '.docker')
  const dockerConfigPath = path.join(dirPath, `config.json`)
  if (!fs.existsSync(dockerConfigPath)) {
    core.warning('Docker config file not found.')
    return {auths: {}}
  }

  const rawConfig = fs.readFileSync(dockerConfigPath, 'utf8')
  return JSON.parse(rawConfig) as DockerConfig
}

export interface DockerAuth {
  username: string
  password: string
}

export function getRegistryAuth(registry: string): DockerAuth | undefined {
  const config = readDockerConfig()
  const auths = config.auths || {}
  const registryAuth = auths[registry]

  if (!registryAuth) {
    core.warning(`No authentication found for registry: ${registry}`)
    return undefined
  }

  const [user, pass] = Buffer.from(registryAuth.auth, 'base64').toString('utf8').split(':')

  return {username: user, password: pass}
}
