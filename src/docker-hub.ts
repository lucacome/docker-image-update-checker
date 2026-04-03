import {GenericRegistry} from './generic-registry.js'

/** Registry client for Docker Hub (`registry-1.docker.io`). */
export class DockerHub extends GenericRegistry {
  constructor() {
    super('registry-1.docker.io', {
      realm: 'https://auth.docker.io/token',
      service: 'registry.docker.io',
      credentialKey: 'https://index.docker.io/v1/',
      name: 'Docker Hub',
    })
  }
}
