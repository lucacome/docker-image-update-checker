import {GenericRegistry} from './generic-registry.js'

/**
 * Registry client for GitLab Container Registry (`registry.gitlab.com`).
 * Token endpoint: https://gitlab.com/jwt/auth
 */
export class GitLabContainerRegistry extends GenericRegistry {
  constructor() {
    super('registry.gitlab.com', {
      realm: 'https://gitlab.com/jwt/auth',
      service: 'container_registry',
      name: 'GitLab Container Registry',
    })
  }
}
