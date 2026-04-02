import {GenericBearerRegistry} from './generic-bearer-registry.js'

/**
 * Registry client for Azure Container Registry (`<name>.azurecr.io`).
 * Accepts service principal credentials, admin account credentials, or
 * scoped repository tokens — all stored in the Docker config under the
 * registry hostname (as written by `docker login <name>.azurecr.io`).
 */
export class AzureContainerRegistry extends GenericBearerRegistry {
  constructor(hostname: string) {
    super({
      baseUrl: `${hostname}/v2/`,
      tokenUrl: `https://${hostname}/oauth2/token`,
      service: hostname,
      credentialKey: hostname,
      name: 'Azure Container Registry',
    })
  }
}
