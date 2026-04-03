import {jest, describe, it, expect, beforeEach} from '@jest/globals'
import {GoogleArtifactRegistry} from '../src/gar.js'
import {mockResponse} from './registry-test-utils.js'

const TOKEN_RESPONSE = {access_token: 'ar-token'}

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

describe('GoogleArtifactRegistry', () => {
  let ar: GoogleArtifactRegistry
  const hostname = 'us-docker.pkg.dev'

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    ar = new GoogleArtifactRegistry(hostname)
    jest.spyOn(ar as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  describe('getToken', () => {
    it('should fetch token from Google OAuth2 endpoint with service derived from hostname', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (ar as unknown as {getToken: (r: string) => Promise<string>}).getToken('myproject/myrepo/myimage')

      expect(token).toBe('ar-token')
      expect(fetch).toHaveBeenCalledWith(
        'https://us-docker.pkg.dev/v2/token?service=us-docker.pkg.dev&scope=repository%3Amyproject%2Fmyrepo%2Fmyimage%3Apull',
        {headers: {}},
      )
    })

    it('should include Basic auth header when credentials are present', async () => {
      jest
        .spyOn(ar as unknown as {getCredentials: () => unknown}, 'getCredentials')
        .mockReturnValue({username: 'oauth2accesstoken', password: 'ya29.accesstoken'})
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (ar as unknown as {getToken: (r: string) => Promise<string>}).getToken('myproject/myrepo/myimage')

      const callArgs = jest.mocked(fetch).mock.calls[0]
      const headers = (callArgs[1] as RequestInit).headers as Record<string, string>
      expect(headers['Authorization']).toMatch(/^Basic /)
    })

    it('should use a different service param when constructed with a different region hostname', async () => {
      const arEurope = new GoogleArtifactRegistry('europe-docker.pkg.dev')
      jest.spyOn(arEurope as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (arEurope as unknown as {getToken: (r: string) => Promise<string>}).getToken('project/repo/image')

      expect(fetch).toHaveBeenCalledWith(
        'https://europe-docker.pkg.dev/v2/token?service=europe-docker.pkg.dev&scope=repository%3Aproject%2Frepo%2Fimage%3Apull',
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

      await ar.getImageInfo({repository: 'myproject/myrepo/myimage', tag: 'latest'})

      const calls = jest.mocked(fetch).mock.calls
      expect(calls[1][0]).toBe('https://us-docker.pkg.dev/v2/myproject/myrepo/myimage/manifests/latest')
    })
  })
})
