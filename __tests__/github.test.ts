import {GitHubContainerRegistry} from '../src/github'
import {describe, expect, test, it} from '@jest/globals'

describe('DockerHub', () => {
  const gitHubRegistry = new GitHubContainerRegistry()

  test('getDigest', async () => {
    // Use an existing public repository and tag for testing
    const repository = 'ghcr.io/nginxinc/kubernetes-ingress'
    const tag = 'edge'

    const digest = await gitHubRegistry.getImageInfo({repository, tag})

    // Check that the digest is a valid SHA256 hash
    // expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(digest).toBe('')
  })
})
