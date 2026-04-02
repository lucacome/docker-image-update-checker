import {jest, describe, it, expect, beforeEach} from '@jest/globals'
import {DockerHub} from '../src/docker-hub.js'
import {ImageMap} from '../src/registry.js'
import {mockResponse} from './registry-test-utils.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const TOKEN_RESPONSE = {token: 'test-token'}

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
    {
      mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
      digest: 'sha256:arm64digest',
      size: 1000,
      platform: {architecture: 'arm64', os: 'linux'},
    },
    {
      mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
      digest: 'sha256:unknowndigest',
      size: 100,
      platform: {architecture: 'unknown', os: 'unknown'},
    },
  ],
}

const AMD64_LAYERS_MANIFEST = {
  schemaVersion: 2,
  mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
  config: {mediaType: 'application/vnd.docker.container.image.v1+json', size: 100, digest: 'sha256:amd64config'},
  layers: [
    {mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip', size: 1000, digest: 'sha256:amd64layer1'},
    {mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip', size: 2000, digest: 'sha256:amd64layer2'},
  ],
}

const ARM64_LAYERS_MANIFEST = {
  schemaVersion: 2,
  mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
  config: {mediaType: 'application/vnd.docker.container.image.v1+json', size: 100, digest: 'sha256:arm64config'},
  layers: [
    {mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip', size: 1000, digest: 'sha256:arm64layer1'},
    {mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip', size: 2000, digest: 'sha256:arm64layer2'},
  ],
}

// Single manifest (no manifest list)
const SINGLE_MANIFEST = {
  schemaVersion: 2,
  mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
  config: {mediaType: 'application/vnd.docker.container.image.v1+json', size: 100, digest: 'sha256:singleconfig'},
  layers: [
    {mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip', size: 1000, digest: 'sha256:singlelayer1'},
    {mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip', size: 2000, digest: 'sha256:singlelayer2'},
  ],
}

const SINGLE_BLOB_CONFIG = {architecture: 'amd64', os: 'linux'}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DockerHub', () => {
  let dockerHub: DockerHub

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    dockerHub = new DockerHub()
    // Prevent real Docker credential store access
    jest.spyOn(dockerHub as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  describe('getToken', () => {
    it('should fetch token anonymously with correct URL', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (dockerHub as unknown as {getToken: (r: string) => Promise<string>}).getToken('library/nginx')

      expect(token).toBe('test-token')
      expect(fetch).toHaveBeenCalledWith(
        'https://auth.docker.io/token?service=registry.docker.io&scope=repository%3Alibrary%2Fnginx%3Apull',
        {headers: {}},
      )
    })

    it('should include Basic auth header when credentials are present', async () => {
      jest
        .spyOn(dockerHub as unknown as {getCredentials: () => unknown}, 'getCredentials')
        .mockReturnValue({username: 'user', password: 'pass'})
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (dockerHub as unknown as {getToken: (r: string) => Promise<string>}).getToken('library/nginx')

      expect(fetch).toHaveBeenCalledWith(
        'https://auth.docker.io/token?service=registry.docker.io&scope=repository%3Alibrary%2Fnginx%3Apull',
        {headers: {Authorization: 'Basic dXNlcjpwYXNz'}},
      )
    })
  })

  describe('getImageInfo', () => {
    it('should return ImageMap from a manifest list (multi-platform), skipping unknown platform', async () => {
      // fetch 1: token
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      // fetch 2: manifest list
      jest.mocked(fetch).mockResolvedValueOnce(
        mockResponse(MANIFEST_LIST, {
          'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json',
          'docker-content-digest': 'sha256:listdigest',
        }),
      )
      // fetch 3: amd64 layers
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))
      // fetch 4: arm64 layers
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(ARM64_LAYERS_MANIFEST))

      const imageMap: ImageMap = await dockerHub.getImageInfo({repository: 'library/nginx', tag: 'latest'})

      // unknown platform must be skipped
      expect(imageMap.size).toBe(2)

      // amd64 entry
      expect(imageMap.has('linux|amd64|')).toBe(true)
      const amd64 = imageMap.get('linux|amd64|')!
      expect(amd64.architecture).toBe('amd64')
      expect(amd64.os).toBe('linux')
      expect(amd64.variant).toBeUndefined()
      expect(amd64.digest).toBe('sha256:amd64digest')
      expect(amd64.layers).toEqual(['sha256:amd64layer1', 'sha256:amd64layer2'])

      // arm64 entry — no explicit variant, architecture is arm64, so variant must be 'v8'
      expect(imageMap.has('linux|arm64|v8')).toBe(true)
      const arm64 = imageMap.get('linux|arm64|v8')!
      expect(arm64.architecture).toBe('arm64')
      expect(arm64.os).toBe('linux')
      expect(arm64.variant).toBe('v8')
      expect(arm64.digest).toBe('sha256:arm64digest')
      expect(arm64.layers).toEqual(['sha256:arm64layer1', 'sha256:arm64layer2'])

      // exactly 4 fetch calls: token + manifest list + 2 platform layers
      expect(fetch).toHaveBeenCalledTimes(4)
    })

    it('should return ImageMap from a single manifest', async () => {
      // fetch 1: token
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      // fetch 2: single manifest
      jest.mocked(fetch).mockResolvedValueOnce(
        mockResponse(SINGLE_MANIFEST, {
          'content-type': 'application/vnd.docker.distribution.manifest.v2+json',
          'docker-content-digest': 'sha256:overalldigest',
        }),
      )
      // fetch 3: blob config
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(SINGLE_BLOB_CONFIG))
      // fetch 4: getLayers (fetches manifest by overall digest)
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(SINGLE_MANIFEST))

      const imageMap: ImageMap = await dockerHub.getImageInfo({repository: 'myorg/myimage', tag: '1.0.0'})

      expect(imageMap.size).toBe(1)
      expect(imageMap.has('linux|amd64|')).toBe(true)
      const entry = imageMap.get('linux|amd64|')!
      expect(entry.architecture).toBe('amd64')
      expect(entry.os).toBe('linux')
      expect(entry.variant).toBeUndefined()
      expect(entry.digest).toBe('sha256:overalldigest')
      expect(entry.layers).toEqual(['sha256:singlelayer1', 'sha256:singlelayer2'])

      // token + manifest + blob + getLayers
      expect(fetch).toHaveBeenCalledTimes(4)
    })

    it('should throw with the actual content type when it is not recognised', async () => {
      // fetch 1: token
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      // fetch 2: manifest with an unrecognised content type
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse({}, {'content-type': 'application/json'}))

      await expect(dockerHub.getImageInfo({repository: 'library/nginx', tag: 'latest'})).rejects.toThrow(
        'Unsupported content type: application/json',
      )
    })

    it('should throw when docker-content-digest header is absent on a single manifest', async () => {
      // fetch 1: token
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      // fetch 2: single manifest — no docker-content-digest header
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(mockResponse(SINGLE_MANIFEST, {'content-type': 'application/vnd.docker.distribution.manifest.v2+json'}))

      await expect(dockerHub.getImageInfo({repository: 'myorg/myimage', tag: '1.0.0'})).rejects.toThrow(
        'Missing docker-content-digest header for myorg/myimage:1.0.0',
      )
    })

    it('should throw when blob config is missing required architecture or os fields', async () => {
      // fetch 1: token
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      // fetch 2: single manifest
      jest.mocked(fetch).mockResolvedValueOnce(
        mockResponse(SINGLE_MANIFEST, {
          'content-type': 'application/vnd.docker.distribution.manifest.v2+json',
          'docker-content-digest': 'sha256:overalldigest',
        }),
      )
      // fetch 3: blob config missing 'os'
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse({architecture: 'amd64'}))

      await expect(dockerHub.getImageInfo({repository: 'myorg/myimage', tag: '1.0.0'})).rejects.toThrow(
        'Blob config for myorg/myimage:1.0.0 is missing required fields',
      )
    })

    it('should return empty layers when a platform manifest has no layers field', async () => {
      // fetch 1: token
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      // fetch 2: manifest list
      jest.mocked(fetch).mockResolvedValueOnce(
        mockResponse(MANIFEST_LIST, {
          'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json',
          'docker-content-digest': 'sha256:listdigest',
        }),
      )
      // fetch 3: amd64 manifest — no layers field
      jest.mocked(fetch).mockResolvedValueOnce(
        mockResponse({
          schemaVersion: 2,
          mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
          config: {mediaType: 'application/vnd.docker.container.image.v1+json', size: 100, digest: 'sha256:amd64config'},
        }),
      )
      // fetch 4: arm64 manifest — no layers field
      jest.mocked(fetch).mockResolvedValueOnce(
        mockResponse({
          schemaVersion: 2,
          mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
          config: {mediaType: 'application/vnd.docker.container.image.v1+json', size: 100, digest: 'sha256:arm64config'},
        }),
      )

      const imageMap: ImageMap = await dockerHub.getImageInfo({repository: 'library/nginx', tag: 'latest'})

      // unknown platform skipped, so 2 entries (amd64 + arm64)
      expect(imageMap.size).toBe(2)
      expect(imageMap.get('linux|amd64|')!.layers).toEqual([])
      expect(imageMap.get('linux|arm64|v8')!.layers).toEqual([])
    })

    it('should skip manifest entries with no platform field (OCI image-index spec: platform is OPTIONAL)', async () => {
      // A manifest list where one entry has no platform (e.g. a nested index / referrer entry)
      const manifestListWithMissingPlatform = {
        schemaVersion: 2,
        mediaType: 'application/vnd.docker.distribution.manifest.list.v2+json',
        manifests: [
          {
            mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
            digest: 'sha256:amd64digest',
            size: 1000,
            platform: {architecture: 'amd64', os: 'linux'},
          },
          {
            // No platform field — must be skipped without crashing
            mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
            digest: 'sha256:noPlatformDigest',
            size: 500,
          },
        ],
      }

      // fetch 1: token
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      // fetch 2: manifest list
      jest.mocked(fetch).mockResolvedValueOnce(
        mockResponse(manifestListWithMissingPlatform, {
          'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json',
          'docker-content-digest': 'sha256:listdigest',
        }),
      )
      // fetch 3: amd64 layers (only one non-skipped platform)
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))

      const imageMap: ImageMap = await dockerHub.getImageInfo({repository: 'library/nginx', tag: 'latest'})

      // Only the amd64 entry should be present; the no-platform entry must be silently skipped
      expect(imageMap.size).toBe(1)
      expect(imageMap.has('linux|amd64|')).toBe(true)
      // exactly 3 fetch calls: token + manifest list + 1 platform layer fetch
      expect(fetch).toHaveBeenCalledTimes(3)
    })
  })
})
