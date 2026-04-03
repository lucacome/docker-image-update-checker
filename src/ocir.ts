import {GenericRegistry} from './generic-registry.js'

/**
 * Registry client for Oracle Cloud Infrastructure Registry (OCIR).
 * Hostname pattern: `<region>.ocir.io` (e.g. `iad.ocir.io`, `fra.ocir.io`).
 * Token endpoint is region-specific: `https://<hostname>/20180419/docker/token`
 */
export class OracleContainerRegistry extends GenericRegistry {
  constructor(hostname: string) {
    super(hostname, {
      realm: `https://${hostname}/20180419/docker/token`,
      service: hostname,
      name: 'Oracle Cloud Infrastructure Registry',
    })
  }
}
