import {GenericRegistry} from './generic-registry.js'

/**
 * Registry client for DigitalOcean Container Registry (`registry.digitalocean.com`).
 * Token endpoint: https://api.digitalocean.com/v2/registry/auth
 */
export class DigitalOceanContainerRegistry extends GenericRegistry {
  constructor() {
    super('registry.digitalocean.com', {
      realm: 'https://api.digitalocean.com/v2/registry/auth',
      service: 'registry.digitalocean.com',
      name: 'DigitalOcean Container Registry',
    })
  }
}
