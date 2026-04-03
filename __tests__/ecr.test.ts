import {jest, describe, it, expect, beforeEach} from '@jest/globals'
import {ECRPublicRegistry, ECRPrivateRegistry} from '../src/ecr.js'
import {mockResponse} from './registry-test-utils.js'

const TOKEN_RESPONSE = {token: 'ecr-token'}

const MANIFEST_LIST = {
  schemaVersion: 2,
  mediaType: 'application/vnd.docker.distribution.manifest.list.v2+json',
  manifests: [
    {
      mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
      digest: 'sha256:amd64digest',
      size: 1000,
      platform: {architecture: 'amd64', os: 'linux'},
    },
  ],
}

const AMD64_LAYERS_MANIFEST = {
  schemaVersion: 2,
  layers: [{digest: 'sha256:amd64layer1'}],
}

const PRIVATE_HOSTNAME = '123456789012.dkr.ecr.us-east-1.amazonaws.com'

describe('ECRPublicRegistry', () => {
  let ecr: ECRPublicRegistry

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    ecr = new ECRPublicRegistry()
    jest.spyOn(ecr as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  describe('getToken', () => {
    it('should fetch token anonymously with correct URL and service param', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (ecr as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      expect(token).toBe('ecr-token')
      expect(fetch).toHaveBeenCalledWith('https://public.ecr.aws/token/?service=public.ecr.aws&scope=repository%3Amyorg%2Fmyrepo%3Apull', {
        headers: {},
      })
    })

    it('should include Basic auth header when credentials are present', async () => {
      jest
        .spyOn(ecr as unknown as {getCredentials: () => unknown}, 'getCredentials')
        .mockReturnValue({username: 'AWS', password: 'ecr-public-password'})
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (ecr as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      expect(fetch).toHaveBeenCalledWith(
        'https://public.ecr.aws/token/?service=public.ecr.aws&scope=repository%3Amyorg%2Fmyrepo%3Apull',
        expect.objectContaining({headers: expect.objectContaining({Authorization: expect.stringMatching(/^Basic /)})}),
      )
    })
  })

  describe('getImageInfo', () => {
    it('should use public.ecr.aws base URL when fetching manifests', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(mockResponse(MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}))
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))

      await ecr.getImageInfo({repository: 'myorg/myrepo', tag: 'latest'})

      const calls = jest.mocked(fetch).mock.calls
      expect(calls[1][0]).toBe('https://public.ecr.aws/v2/myorg/myrepo/manifests/latest')
    })
  })
})

describe('ECRPrivateRegistry', () => {
  let ecr: ECRPrivateRegistry

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    ecr = new ECRPrivateRegistry(PRIVATE_HOSTNAME)
    jest.spyOn(ecr as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  describe('getToken', () => {
    it('should fetch token anonymously with correct URL and service param', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (ecr as unknown as {getToken: (r: string) => Promise<string>}).getToken('myrepo')

      expect(token).toBe('ecr-token')
      expect(fetch).toHaveBeenCalledWith(`https://${PRIVATE_HOSTNAME}/?service=ecr.amazonaws.com&scope=repository%3Amyrepo%3Apull`, {
        headers: {},
      })
    })

    it('should include Basic auth header when credentials are present (AWS:token)', async () => {
      jest
        .spyOn(ecr as unknown as {getCredentials: () => unknown}, 'getCredentials')
        .mockReturnValue({username: 'AWS', password: 'ecr-private-password'})
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (ecr as unknown as {getToken: (r: string) => Promise<string>}).getToken('myrepo')

      expect(fetch).toHaveBeenCalledWith(
        `https://${PRIVATE_HOSTNAME}/?service=ecr.amazonaws.com&scope=repository%3Amyrepo%3Apull`,
        expect.objectContaining({headers: expect.objectContaining({Authorization: expect.stringMatching(/^Basic /)})}),
      )
    })
  })

  describe('getImageInfo', () => {
    it('should use the private registry hostname as the base URL when fetching manifests', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(mockResponse(MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}))
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))

      await ecr.getImageInfo({repository: 'myrepo', tag: 'latest'})

      const calls = jest.mocked(fetch).mock.calls
      expect(calls[1][0]).toBe(`https://${PRIVATE_HOSTNAME}/v2/myrepo/manifests/latest`)
    })
  })
})
