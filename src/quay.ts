import {GenericBearerRegistry} from './generic-bearer-registry.js'

/**
 * Registry client for Quay.io (`quay.io`).
 * Public repositories can be pulled anonymously; robot accounts
 * (username format `namespace+robotname`) are used for private repos.
 */
export class QuayRegistry extends GenericBearerRegistry {
  constructor() {
    super({
      baseUrl: 'quay.io/v2/',
      tokenUrl: 'https://quay.io/v2/auth',
      service: 'quay.io',
      credentialKey: 'quay.io',
      name: 'Quay',
    })
  }
}
