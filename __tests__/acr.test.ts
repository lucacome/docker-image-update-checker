import {jest, describe, it, expect, beforeEach} from '@jest/globals'
import {AzureContainerRegistry} from '../src/acr.js'
import {mockResponse} from './registry-test-utils.js'

const TOKEN_RESPONSE = {access_token: 'acr-token'}

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

describe('AzureContainerRegistry', () => {
  let acr: AzureContainerRegistry
  const hostname = 'myregistry.azurecr.io'

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    acr = new AzureContainerRegistry(hostname)
    jest.spyOn(acr as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  describe('getToken', () => {
    it('should fetch token anonymously with correct URL and service param derived from hostname', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (acr as unknown as {getToken: (r: string) => Promise<string>}).getToken('myrepo/myimage')

      expect(token).toBe('acr-token')
      expect(fetch).toHaveBeenCalledWith(
        'https://myregistry.azurecr.io/oauth2/token?service=myregistry.azurecr.io&scope=repository%3Amyrepo%2Fmyimage%3Apull',
        {headers: {}},
      )
    })

    it('should include Basic auth header when credentials are present', async () => {
      jest
        .spyOn(acr as unknown as {getCredentials: () => unknown}, 'getCredentials')
        .mockReturnValue({username: 'myapp-sp-id', password: 'client-secret'})
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (acr as unknown as {getToken: (r: string) => Promise<string>}).getToken('myrepo/myimage')

      expect(fetch).toHaveBeenCalledWith(
        'https://myregistry.azurecr.io/oauth2/token?service=myregistry.azurecr.io&scope=repository%3Amyrepo%2Fmyimage%3Apull',
        {headers: {Authorization: 'Basic bXlhcHAtc3AtaWQ6Y2xpZW50LXNlY3JldA=='}},
      )
    })

    it('should adapt token URL when a different hostname is used', async () => {
      const acr2 = new AzureContainerRegistry('otherregistry.azurecr.io')
      jest.spyOn(acr2 as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (acr2 as unknown as {getToken: (r: string) => Promise<string>}).getToken('repo/image')

      expect(fetch).toHaveBeenCalledWith(
        'https://otherregistry.azurecr.io/oauth2/token?service=otherregistry.azurecr.io&scope=repository%3Arepo%2Fimage%3Apull',
        {headers: {}},
      )
    })
  })

  describe('getImageInfo', () => {
    it('should use the registry hostname as base URL when fetching manifests', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(mockResponse(MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}))
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))

      await acr.getImageInfo({repository: 'myrepo/myimage', tag: 'latest'})

      const calls = jest.mocked(fetch).mock.calls
      expect(calls[1][0]).toBe('https://myregistry.azurecr.io/v2/myrepo/myimage/manifests/latest')
    })
  })
})
