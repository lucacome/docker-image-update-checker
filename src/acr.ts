import {GenericRegistry} from './generic-registry.js'

/**
 * Registry client for Azure Container Registry (`<name>.azurecr.io`).
 * Accepts service principal credentials, admin account credentials, or
 * scoped repository tokens — all stored in the Docker config under the
 * registry hostname (as written by `docker login <name>.azurecr.io`).
 */
export class AzureContainerRegistry extends GenericRegistry {
  constructor(hostname: string) {
    super(hostname, {
      realm: `https://${hostname}/oauth2/token`,
      service: hostname,
      credentialKey: hostname,
      name: 'Azure Container Registry',
    })
  }
}
