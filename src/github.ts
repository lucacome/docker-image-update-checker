import {GenericRegistry} from './generic-registry.js'

/** Registry client for GitHub Container Registry (`ghcr.io`). */
export class GitHubContainerRegistry extends GenericRegistry {
  constructor() {
    super('ghcr.io', {
      realm: 'https://ghcr.io/token',
      credentialKey: 'ghcr.io',
      name: 'GitHub Container Registry',
    })
  }
}
