import {GenericRegistry} from './generic-registry.js'

/** Registry client for Amazon ECR Public (`public.ecr.aws`). */
export class ECRPublicRegistry extends GenericRegistry {
  constructor() {
    super('public.ecr.aws', {
      realm: 'https://public.ecr.aws/token/',
      service: 'public.ecr.aws',
      credentialKey: 'public.ecr.aws',
      name: 'Amazon ECR Public',
    })
  }
}

/**
 * Registry client for Amazon ECR Private.
 * @param hostname - e.g. `123456789.dkr.ecr.us-east-1.amazonaws.com`
 */
export class ECRPrivateRegistry extends GenericRegistry {
  constructor(hostname: string) {
    super(hostname, {
      realm: `https://${hostname}/`,
      service: 'ecr.amazonaws.com',
      credentialKey: hostname,
      name: 'Amazon ECR',
    })
  }
}
