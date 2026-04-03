import {GenericRegistry} from './generic-registry.js'

/**
 * Registry client for Quay.io (`quay.io`).
 * Public repositories can be pulled anonymously; robot accounts
 * (username format `namespace+robotname`) are used for private repos.
 */
export class QuayRegistry extends GenericRegistry {
  constructor() {
    super('quay.io', {
      realm: 'https://quay.io/v2/auth',
      service: 'quay.io',
      credentialKey: 'quay.io',
      name: 'Quay',
    })
  }
}
