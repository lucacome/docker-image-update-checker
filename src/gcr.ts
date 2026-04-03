import {GenericRegistry} from './generic-registry.js'

/**
 * Registry client for Google Container Registry (`gcr.io` and regional variants
 * such as `us.gcr.io`, `eu.gcr.io`, `asia.gcr.io`).
 * Credentials are stored in the Docker config under the bare hostname
 * (as written by `docker login gcr.io` or `docker/login-action`).
 */
export class GoogleContainerRegistry extends GenericRegistry {
  constructor(hostname: string = 'gcr.io') {
    super(hostname, {
      realm: `https://${hostname}/v2/token`,
      service: hostname,
      credentialKey: hostname,
      name: 'Google Container Registry',
    })
  }
}
