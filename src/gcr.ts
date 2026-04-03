import {GenericRegistry} from './generic-registry.js'

/**
 * Registry client for Google Container Registry (`gcr.io` and regional variants
 * such as `us.gcr.io`, `eu.gcr.io`, `asia.gcr.io`).
 * Credentials are stored in the Docker config under `https://<hostname>`
 * (as written by `gcloud auth configure-docker <hostname>`).
 */
export class GoogleContainerRegistry extends GenericRegistry {
  constructor(hostname: string = 'gcr.io') {
    super(hostname, {
      realm: `https://${hostname}/v2/token`,
      service: hostname,
      credentialKey: `https://${hostname}`,
      name: 'Google Container Registry',
    })
  }
}
