import {jest, describe, it, expect, beforeEach} from '@jest/globals'
import {GenericRegistry} from '../src/generic-registry.js'
import {mockResponse} from './registry-test-utils.js'

const TOKEN_RESPONSE = {token: 'generic-token'}

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

const HOSTNAME = 'registry.example.com'

/** Returns a mock 401 response with a Bearer WWW-Authenticate header. */
function mockBearerChallenge(realm: string, service?: string): Response {
  const wwwAuth = service ? `Bearer realm="${realm}",service="${service}"` : `Bearer realm="${realm}"`
  return {
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    headers: {
      get: (name: string) => (name.toLowerCase() === 'www-authenticate' ? wwwAuth : null),
      entries: () => Object.entries({'www-authenticate': wwwAuth})[Symbol.iterator](),
    },
    json: jest.fn() as jest.MockedFunction<() => Promise<unknown>>,
    text: jest.fn() as jest.MockedFunction<() => Promise<string>>,
  } as unknown as Response
}

/** Returns a mock 200 response with no auth challenge (fully open registry). */
function mockOpenRegistry(): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: () => null,
      entries: () => [][Symbol.iterator](),
    },
    json: jest.fn() as jest.MockedFunction<() => Promise<unknown>>,
    text: jest.fn() as jest.MockedFunction<() => Promise<string>>,
  } as unknown as Response
}

describe('GenericRegistry — static config mode', () => {
  const REALM = 'https://auth.example.com/token'
  const SERVICE = 'registry.example.com'
  let registry: GenericRegistry

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    registry = new GenericRegistry(HOSTNAME, {realm: REALM, service: SERVICE})
    jest.spyOn(registry as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  describe('getToken', () => {
    it('should fetch token directly without probing /v2/', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (registry as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      expect(token).toBe('generic-token')
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledWith(`${REALM}?service=${SERVICE}&scope=repository%3Amyorg%2Fmyrepo%3Apull`, {headers: {}})
    })

    it('should use credentialKey override when looking up credentials', async () => {
      const customCredentialKey = 'custom-cred-key'
      const staticRegistry = new GenericRegistry(HOSTNAME, {realm: REALM, credentialKey: customCredentialKey})
      const spy = jest.spyOn(staticRegistry as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (staticRegistry as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      expect(spy).toHaveBeenCalled()
    })
  })

  describe('getImageInfo', () => {
    it('should use the hostname as base URL when fetching manifests', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(mockResponse(MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}))
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))

      await registry.getImageInfo({repository: 'myorg/myrepo', tag: 'latest'})

      const calls = jest.mocked(fetch).mock.calls
      expect(calls[1][0]).toBe(`https://${HOSTNAME}/v2/myorg/myrepo/manifests/latest`)
    })
  })
})

describe('GenericRegistry — discovery mode', () => {
  let registry: GenericRegistry

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    registry = new GenericRegistry(HOSTNAME)
    jest.spyOn(registry as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  describe('getToken — Bearer challenge discovered', () => {
    it('should probe /v2/ and fetch a token using the discovered realm and service', async () => {
      // Call 1: discovery probe → 401 with Bearer challenge
      jest.mocked(fetch).mockResolvedValueOnce(mockBearerChallenge('https://auth.example.com/token', HOSTNAME))
      // Call 2: token fetch
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (registry as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      expect(token).toBe('generic-token')
      const calls = jest.mocked(fetch).mock.calls
      expect(calls[0][0]).toBe(`https://${HOSTNAME}/v2/`)
      expect(calls[1][0]).toBe(`https://auth.example.com/token?service=${HOSTNAME}&scope=repository%3Amyorg%2Fmyrepo%3Apull`)
    })

    it('should omit the service param when the challenge has no service', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockBearerChallenge('https://auth.example.com/token'))
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (registry as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      const calls = jest.mocked(fetch).mock.calls
      expect(calls[1][0]).toBe('https://auth.example.com/token?scope=repository%3Amyorg%2Fmyrepo%3Apull')
    })

    it('should include Basic auth header when credentials are present', async () => {
      jest
        .spyOn(registry as unknown as {getCredentials: () => unknown}, 'getCredentials')
        .mockReturnValue({username: 'user', password: 'pass'})
      jest.mocked(fetch).mockResolvedValueOnce(mockBearerChallenge('https://auth.example.com/token', HOSTNAME))
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (registry as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      expect(fetch).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({headers: expect.objectContaining({Authorization: expect.stringMatching(/^Basic /)})}),
      )
    })

    it('should only probe /v2/ once even when getToken is called multiple times', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockBearerChallenge('https://auth.example.com/token', HOSTNAME))
      jest.mocked(fetch).mockResolvedValue(mockResponse(TOKEN_RESPONSE))

      const getToken = (r: string) => (registry as unknown as {getToken: (r: string) => Promise<string>}).getToken(r)
      await Promise.all([getToken('org/repo'), getToken('org/repo')])

      const probeCalls = jest.mocked(fetch).mock.calls.filter((c) => c[0] === `https://${HOSTNAME}/v2/`)
      expect(probeCalls).toHaveLength(1)
    })
  })

  describe('getToken — no Bearer challenge', () => {
    it('should return empty string when the registry is fully open (200 response)', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockOpenRegistry())

      const token = await (registry as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      expect(token).toBe('')
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('should return empty string when discovery probe fails with a network error', async () => {
      jest.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const token = await (registry as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      expect(token).toBe('')
    })

    it('should return empty string when 401 has no WWW-Authenticate header', async () => {
      const noHeaderResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: {
          get: () => null,
          entries: () => [][Symbol.iterator](),
        },
        json: jest.fn() as jest.MockedFunction<() => Promise<unknown>>,
        text: jest.fn() as jest.MockedFunction<() => Promise<string>>,
      } as unknown as Response
      jest.mocked(fetch).mockResolvedValueOnce(noHeaderResponse)

      const token = await (registry as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      expect(token).toBe('')
    })

    it('should parse unquoted token-style WWW-Authenticate params', async () => {
      const wwwAuth = `Bearer realm=https://auth.example.com/token,service=${HOSTNAME}`
      const unquotedChallenge = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: {
          get: (name: string) => (name.toLowerCase() === 'www-authenticate' ? wwwAuth : null),
          entries: () => Object.entries({'www-authenticate': wwwAuth})[Symbol.iterator](),
        },
        json: jest.fn() as jest.MockedFunction<() => Promise<unknown>>,
        text: jest.fn() as jest.MockedFunction<() => Promise<string>>,
      } as unknown as Response
      jest.mocked(fetch).mockResolvedValueOnce(unquotedChallenge)
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (registry as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      expect(token).toBe('generic-token')
      const calls = jest.mocked(fetch).mock.calls
      expect(calls[1][0]).toBe(`https://auth.example.com/token?service=${HOSTNAME}&scope=repository%3Amyorg%2Fmyrepo%3Apull`)
    })

    it('should return empty string when WWW-Authenticate is Basic (not Bearer)', async () => {
      const basicResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: {
          get: (name: string) => (name.toLowerCase() === 'www-authenticate' ? 'Basic realm="Registry"' : null),
          entries: () => Object.entries({'www-authenticate': 'Basic realm="Registry"'})[Symbol.iterator](),
        },
        json: jest.fn() as jest.MockedFunction<() => Promise<unknown>>,
        text: jest.fn() as jest.MockedFunction<() => Promise<string>>,
      } as unknown as Response
      jest.mocked(fetch).mockResolvedValueOnce(basicResponse)

      const token = await (registry as unknown as {getToken: (r: string) => Promise<string>}).getToken('myorg/myrepo')

      expect(token).toBe('')
    })
  })

  describe('getImageInfo', () => {
    it('should use the hostname as base URL when fetching manifests', async () => {
      // discovery probe → Bearer challenge
      jest.mocked(fetch).mockResolvedValueOnce(mockBearerChallenge('https://auth.example.com/token', HOSTNAME))
      // token fetch
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      // manifest list
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(mockResponse(MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}))
      // layers
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))

      await registry.getImageInfo({repository: 'myorg/myrepo', tag: 'latest'})

      const calls = jest.mocked(fetch).mock.calls
      // The manifest fetch is the third call (index 2)
      expect(calls[2][0]).toBe(`https://${HOSTNAME}/v2/myorg/myrepo/manifests/latest`)
    })

    it('should omit Authorization header on manifest and layer fetches when token is empty (open registry)', async () => {
      // discovery probe → open registry (no Bearer challenge)
      jest.mocked(fetch).mockResolvedValueOnce(mockOpenRegistry())
      // manifest list fetch (no token → no Authorization header)
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(mockResponse(MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}))
      // layers fetch
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))

      await registry.getImageInfo({repository: 'myorg/myrepo', tag: 'latest'})

      const calls = jest.mocked(fetch).mock.calls
      // call index 1 is the manifest fetch; its headers must NOT contain Authorization
      const manifestHeaders = calls[1][1]?.headers as Record<string, string> | undefined
      expect(manifestHeaders).not.toHaveProperty('Authorization')
      // call index 2 is the layers fetch; same expectation
      const layersHeaders = calls[2][1]?.headers as Record<string, string> | undefined
      expect(layersHeaders).not.toHaveProperty('Authorization')
    })
  })
})
