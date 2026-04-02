import {jest, describe, it, expect, beforeEach} from '@jest/globals'
import {GoogleContainerRegistry} from '../src/gcr.js'
import {mockResponse} from './registry-test-utils.js'

const TOKEN_RESPONSE = {access_token: 'gcr-token'}

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

describe('GoogleContainerRegistry', () => {
  let gcr: GoogleContainerRegistry

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    gcr = new GoogleContainerRegistry()
    jest.spyOn(gcr as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  describe('getToken', () => {
    it('should fetch token anonymously with correct URL and service param', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (gcr as unknown as {getToken: (r: string) => Promise<string>}).getToken('myproject/myimage')

      expect(token).toBe('gcr-token')
      expect(fetch).toHaveBeenCalledWith('https://gcr.io/v2/token?service=gcr.io&scope=repository%3Amyproject%2Fmyimage%3Apull', {
        headers: {},
      })
    })

    it('should include Basic auth header when credentials are present', async () => {
      jest
        .spyOn(gcr as unknown as {getCredentials: () => unknown}, 'getCredentials')
        .mockReturnValue({username: '_json_key', password: '{"type":"service_account"}'})
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (gcr as unknown as {getToken: (r: string) => Promise<string>}).getToken('myproject/myimage')

      expect(fetch).toHaveBeenCalledWith(
        'https://gcr.io/v2/token?service=gcr.io&scope=repository%3Amyproject%2Fmyimage%3Apull',
        expect.objectContaining({headers: expect.objectContaining({Authorization: expect.stringMatching(/^Basic /)})}),
      )
    })
  })

  describe('getImageInfo', () => {
    it('should use gcr.io base URL when fetching manifests', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(mockResponse(MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}))
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))

      await gcr.getImageInfo({repository: 'myproject/myimage', tag: 'latest'})

      const calls = jest.mocked(fetch).mock.calls
      expect(calls[1][0]).toBe('https://gcr.io/v2/myproject/myimage/manifests/latest')
    })
  })
})
