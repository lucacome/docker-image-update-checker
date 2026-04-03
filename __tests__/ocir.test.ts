import {jest, describe, it, expect, beforeEach} from '@jest/globals'
import {OracleContainerRegistry} from '../src/ocir.js'
import {mockResponse} from './registry-test-utils.js'

const TOKEN_RESPONSE = {token: 'ocir-token'}

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

describe('OracleContainerRegistry', () => {
  let ocir: OracleContainerRegistry

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    ocir = new OracleContainerRegistry('iad.ocir.io')
    jest.spyOn(ocir as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  describe('getToken', () => {
    it('should fetch token using region-specific endpoint with correct service param', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (ocir as unknown as {getToken: (r: string) => Promise<string>}).getToken('mytenancy/myrepo')

      expect(token).toBe('ocir-token')
      expect(fetch).toHaveBeenCalledWith(
        'https://iad.ocir.io/20180419/docker/token?service=iad.ocir.io&scope=repository%3Amytenancy%2Fmyrepo%3Apull',
        {headers: {}},
      )
    })

    it('should include Basic auth header when credentials are present', async () => {
      jest
        .spyOn(ocir as unknown as {getCredentials: () => unknown}, 'getCredentials')
        .mockReturnValue({username: 'mytenancy/myuser', password: 'myauthtoken'})
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (ocir as unknown as {getToken: (r: string) => Promise<string>}).getToken('mytenancy/myrepo')

      expect(fetch).toHaveBeenCalledWith(
        'https://iad.ocir.io/20180419/docker/token?service=iad.ocir.io&scope=repository%3Amytenancy%2Fmyrepo%3Apull',
        {headers: {Authorization: 'Basic bXl0ZW5hbmN5L215dXNlcjpteWF1dGh0b2tlbg=='}},
      )
    })

    it('should use the correct region-specific token endpoint for a different region', async () => {
      const fraOcir = new OracleContainerRegistry('fra.ocir.io')
      jest.spyOn(fraOcir as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (fraOcir as unknown as {getToken: (r: string) => Promise<string>}).getToken('mytenancy/myrepo')

      expect(fetch).toHaveBeenCalledWith(
        'https://fra.ocir.io/20180419/docker/token?service=fra.ocir.io&scope=repository%3Amytenancy%2Fmyrepo%3Apull',
        {headers: {}},
      )
    })
  })

  describe('getImageInfo', () => {
    it('should use region-specific base URL when fetching manifests', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(mockResponse(MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}))
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))

      await ocir.getImageInfo({repository: 'mytenancy/myrepo', tag: 'latest'})

      const calls = jest.mocked(fetch).mock.calls
      expect(calls[1][0]).toBe('https://iad.ocir.io/v2/mytenancy/myrepo/manifests/latest')
    })
  })
})
