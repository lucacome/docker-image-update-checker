import {GenericBearerRegistry} from './generic-bearer-registry.js'

/**
 * Registry client for Google Container Registry (`gcr.io`).
 * Credentials are stored in the Docker config under `https://gcr.io`
 * (as written by `gcloud auth configure-docker gcr.io`).
 */
export class GoogleContainerRegistry extends GenericBearerRegistry {
  constructor() {
    super({
      baseUrl: 'gcr.io/v2/',
      tokenUrl: 'https://gcr.io/v2/token',
      service: 'gcr.io',
      credentialKey: 'https://gcr.io',
      name: 'Google Container Registry',
    })
  }
}
