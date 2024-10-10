import {DockerHub} from '../src/docker-hub'
import {findDiffImages} from '../src/image-utils'

describe('DockerHub', () => {
  const dockerHub = new DockerHub()

  test('getImageInfo', async () => {
    // Use an existing public repository and tag for testing
    const repository = 'library/nginx'
    const repository2 = 'nginx/nginx-ingress'
    const tag = '1.23.4'

    const digest = await dockerHub.getImageInfo({repository, tag})

    // iterate over the digest object and print out the values

    const tag2 = '3.1.0'

    const digest2 = await dockerHub.getImageInfo({repository: repository2, tag: tag2})

    const common = findDiffImages(digest, digest2)
    console.log(common)
    // Check that the digest is a valid SHA256 hash
    // expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(digest).toBe('')
  })
})
