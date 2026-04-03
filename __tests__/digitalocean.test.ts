import {jest, describe, it, expect, beforeEach} from '@jest/globals'
import {DigitalOceanContainerRegistry} from '../src/digitalocean.js'
import {mockResponse} from './registry-test-utils.js'

const TOKEN_RESPONSE = {token: 'do-token'}

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

describe('DigitalOceanContainerRegistry', () => {
  let docr: DigitalOceanContainerRegistry

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    docr = new DigitalOceanContainerRegistry()
    jest.spyOn(docr as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  describe('getToken', () => {
    it('should fetch token anonymously with correct URL and service param', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (docr as unknown as {getToken: (r: string) => Promise<string>}).getToken('myregistry/myrepo')

      expect(token).toBe('do-token')
      expect(fetch).toHaveBeenCalledWith(
        'https://api.digitalocean.com/v2/registry/auth?service=registry.digitalocean.com&scope=repository%3Amyregistry%2Fmyrepo%3Apull',
        {headers: {}},
      )
    })

    it('should include Basic auth header when credentials are present', async () => {
      jest
        .spyOn(docr as unknown as {getCredentials: () => unknown}, 'getCredentials')
        .mockReturnValue({username: 'myemail@example.com', password: 'myapitoken'})
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (docr as unknown as {getToken: (r: string) => Promise<string>}).getToken('myregistry/myrepo')

      expect(fetch).toHaveBeenCalledWith(
        'https://api.digitalocean.com/v2/registry/auth?service=registry.digitalocean.com&scope=repository%3Amyregistry%2Fmyrepo%3Apull',
        {headers: {Authorization: 'Basic bXllbWFpbEBleGFtcGxlLmNvbTpteWFwaXRva2Vu'}},
      )
    })
  })

  describe('getImageInfo', () => {
    it('should use registry.digitalocean.com base URL when fetching manifests', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(mockResponse(MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}))
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))

      await docr.getImageInfo({repository: 'myregistry/myrepo', tag: 'latest'})

      const calls = jest.mocked(fetch).mock.calls
      expect(calls[1][0]).toBe('https://registry.digitalocean.com/v2/myregistry/myrepo/manifests/latest')
    })
  })
})
