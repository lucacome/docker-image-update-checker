import {jest, describe, it, expect, beforeEach} from '@jest/globals'
import {QuayRegistry} from '../src/quay.js'
import {mockResponse} from './registry-test-utils.js'

const TOKEN_RESPONSE = {token: 'quay-token'}

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

describe('QuayRegistry', () => {
  let quay: QuayRegistry

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    quay = new QuayRegistry()
    jest.spyOn(quay as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  describe('getToken', () => {
    it('should fetch token anonymously with correct URL and service param', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (quay as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      expect(token).toBe('quay-token')
      expect(fetch).toHaveBeenCalledWith('https://quay.io/v2/auth?service=quay.io&scope=repository%3Amyorg%2Fmyrepo%3Apull', {headers: {}})
    })

    it('should include Basic auth header when credentials are present', async () => {
      jest
        .spyOn(quay as unknown as {getCredentials: () => unknown}, 'getCredentials')
        .mockReturnValue({username: 'myorg+robot', password: 'robotpassword'})
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (quay as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      expect(fetch).toHaveBeenCalledWith('https://quay.io/v2/auth?service=quay.io&scope=repository%3Amyorg%2Fmyrepo%3Apull', {
        headers: {Authorization: 'Basic bXlvcmcrcm9ib3Q6cm9ib3RwYXNzd29yZA=='},
      })
    })
  })

  describe('getImageInfo', () => {
    it('should use quay.io base URL when fetching manifests', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(mockResponse(MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}))
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))

      await quay.getImageInfo({repository: 'myorg/myrepo', tag: 'latest'})

      const calls = jest.mocked(fetch).mock.calls
      expect(calls[1][0]).toBe('https://quay.io/v2/myorg/myrepo/manifests/latest')
    })
  })
})
