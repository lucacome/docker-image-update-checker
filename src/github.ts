import {GenericBearerRegistry} from './generic-bearer-registry.js'

/** Registry client for GitHub Container Registry (`ghcr.io`). */
export class GitHubContainerRegistry extends GenericBearerRegistry {
  constructor() {
    super({
      baseUrl: 'ghcr.io/v2/',
      tokenUrl: 'https://ghcr.io/token',
      credentialKey: 'ghcr.io',
      name: 'GitHub Container Registry',
    })
  }
}
