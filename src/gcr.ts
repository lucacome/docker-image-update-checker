import {GenericBearerRegistry} from './generic-bearer-registry.js'

/**
 * Registry client for Google Container Registry (`gcr.io` and regional variants
 * such as `us.gcr.io`, `eu.gcr.io`, `asia.gcr.io`).
 * Credentials are stored in the Docker config under `https://<hostname>`
 * (as written by `gcloud auth configure-docker <hostname>`).
 */
export class GoogleContainerRegistry extends GenericBearerRegistry {
  constructor(hostname: string = 'gcr.io') {
    super({
      baseUrl: `${hostname}/v2/`,
      tokenUrl: `https://${hostname}/v2/token`,
      service: hostname,
      credentialKey: `https://${hostname}`,
      name: 'Google Container Registry',
    })
  }
}
