import {GenericBearerRegistry} from './generic-bearer-registry.js'

/**
 * Registry client for Google Artifact Registry (`<region>-docker.pkg.dev`).
 * Credentials are stored in the Docker config under the registry hostname
 * (as written by `gcloud auth configure-docker <region>-docker.pkg.dev`).
 * The username is typically `oauth2accesstoken` with a short-lived GCP access
 * token, or `_json_key` / `_json_key_base64` with a service account key.
 */
export class GoogleArtifactRegistry extends GenericBearerRegistry {
  constructor(hostname: string) {
    super({
      baseUrl: `${hostname}/v2/`,
      tokenUrl: `https://${hostname}/v2/token`,
      service: hostname,
      credentialKey: hostname,
      name: 'Google Artifact Registry',
    })
  }
}
