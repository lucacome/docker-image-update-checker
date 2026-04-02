import {GenericBearerRegistry} from './generic-bearer-registry.js'

/** Registry client for Amazon ECR Public (`public.ecr.aws`). */
export class ECRPublicRegistry extends GenericBearerRegistry {
  constructor() {
    super({
      baseUrl: 'public.ecr.aws/v2/',
      tokenUrl: 'https://public.ecr.aws/token/',
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
export class ECRPrivateRegistry extends GenericBearerRegistry {
  constructor(hostname: string) {
    super({
      baseUrl: `${hostname}/v2/`,
      tokenUrl: `https://${hostname}/`,
      service: 'ecr.amazonaws.com',
      credentialKey: hostname,
      name: 'Amazon ECR',
    })
  }
}
