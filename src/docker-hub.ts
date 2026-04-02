import {GenericBearerRegistry} from './generic-bearer-registry.js'

/** Registry client for Docker Hub (`index.docker.io`). */
export class DockerHub extends GenericBearerRegistry {
  constructor() {
    super({
      baseUrl: 'index.docker.io/v2/',
      tokenUrl: 'https://auth.docker.io/token',
      service: 'registry.docker.io',
      credentialKey: 'https://index.docker.io/v1/',
      name: 'Docker Hub',
    })
  }
}
