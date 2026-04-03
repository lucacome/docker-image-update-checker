import {jest, describe, it, expect, beforeEach} from '@jest/globals'
import {GitLabContainerRegistry} from '../src/gitlab.js'
import {mockResponse} from './registry-test-utils.js'

const TOKEN_RESPONSE = {token: 'gitlab-token'}

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

describe('GitLabContainerRegistry', () => {
  let gitlab: GitLabContainerRegistry

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    gitlab = new GitLabContainerRegistry()
    jest.spyOn(gitlab as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  describe('getToken', () => {
    it('should fetch token anonymously with correct URL and service param', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (gitlab as unknown as {getToken: (r: string) => Promise<string>}).getToken('mygroup/myrepo')

      expect(token).toBe('gitlab-token')
      expect(fetch).toHaveBeenCalledWith(
        'https://gitlab.com/jwt/auth?service=container_registry&scope=repository%3Amygroup%2Fmyrepo%3Apull',
        {headers: {}},
      )
    })

    it('should include Basic auth header when credentials are present', async () => {
      jest
        .spyOn(gitlab as unknown as {getCredentials: () => unknown}, 'getCredentials')
        .mockReturnValue({username: 'myuser', password: 'mytoken'})
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (gitlab as unknown as {getToken: (r: string) => Promise<string>}).getToken('mygroup/myrepo')

      expect(fetch).toHaveBeenCalledWith(
        'https://gitlab.com/jwt/auth?service=container_registry&scope=repository%3Amygroup%2Fmyrepo%3Apull',
        {headers: {Authorization: 'Basic bXl1c2VyOm15dG9rZW4='}},
      )
    })
  })

  describe('getImageInfo', () => {
    it('should use registry.gitlab.com base URL when fetching manifests', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(mockResponse(MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}))
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))

      await gitlab.getImageInfo({repository: 'mygroup/myrepo', tag: 'latest'})

      const calls = jest.mocked(fetch).mock.calls
      expect(calls[1][0]).toBe('https://registry.gitlab.com/v2/mygroup/myrepo/manifests/latest')
    })
  })
})
