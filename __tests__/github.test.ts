import {jest, describe, it, expect, beforeEach} from '@jest/globals'
import {GitHubContainerRegistry} from '../src/github.js'
import {ImageMap} from '../src/registry.js'
import {mockResponse} from './registry-test-utils.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const TOKEN_RESPONSE = {token: 'test-token'}

// OCI image index (multi-platform): amd64, arm64 (no variant → 'v8'), arm/v7 (explicit variant), unknown (skipped)
const OCI_INDEX = {
  schemaVersion: 2,
  mediaType: 'application/vnd.oci.image.index.v1+json',
  manifests: [
    {
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      digest: 'sha256:amd64digest',
      size: 1000,
      platform: {architecture: 'amd64', os: 'linux'},
    },
    {
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      digest: 'sha256:arm64digest',
      size: 1000,
      platform: {architecture: 'arm64', os: 'linux'},
    },
    {
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      digest: 'sha256:armv7digest',
      size: 1000,
      platform: {architecture: 'arm', os: 'linux', variant: 'v7'},
    },
    {
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      digest: 'sha256:unknowndigest',
      size: 100,
      platform: {architecture: 'unknown', os: 'unknown'},
    },
  ],
}

const AMD64_LAYERS_MANIFEST = {
  schemaVersion: 2,
  mediaType: 'application/vnd.oci.image.manifest.v1+json',
  config: {mediaType: 'application/vnd.oci.image.config.v1+json', size: 100, digest: 'sha256:amd64config'},
  layers: [
    {mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', size: 1000, digest: 'sha256:amd64layer1'},
    {mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', size: 2000, digest: 'sha256:amd64layer2'},
  ],
}

const ARM64_LAYERS_MANIFEST = {
  schemaVersion: 2,
  mediaType: 'application/vnd.oci.image.manifest.v1+json',
  config: {mediaType: 'application/vnd.oci.image.config.v1+json', size: 100, digest: 'sha256:arm64config'},
  layers: [{mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', size: 1000, digest: 'sha256:arm64layer1'}],
}

const ARMV7_LAYERS_MANIFEST = {
  schemaVersion: 2,
  mediaType: 'application/vnd.oci.image.manifest.v1+json',
  config: {mediaType: 'application/vnd.oci.image.config.v1+json', size: 100, digest: 'sha256:armv7config'},
  layers: [{mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', size: 1000, digest: 'sha256:armv7layer1'}],
}

// Single OCI manifest
const SINGLE_MANIFEST = {
  schemaVersion: 2,
  mediaType: 'application/vnd.oci.image.manifest.v1+json',
  config: {mediaType: 'application/vnd.oci.image.config.v1+json', size: 100, digest: 'sha256:singleconfig'},
  layers: [
    {mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', size: 1000, digest: 'sha256:singlelayer1'},
    {mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', size: 2000, digest: 'sha256:singlelayer2'},
  ],
}

const SINGLE_BLOB_CONFIG = {architecture: 'amd64', os: 'linux'}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GitHubContainerRegistry', () => {
  let ghcr: GitHubContainerRegistry

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    ghcr = new GitHubContainerRegistry()
    // Prevent real Docker credential store access
    jest.spyOn(ghcr as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  describe('getToken', () => {
    it('should fetch token anonymously with correct URL (no service param)', async () => {
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      const token = await (ghcr as unknown as {getToken: (r: string) => Promise<string>}).getToken('nginx/nginx-gateway-fabric/nginx')

      expect(token).toBe('test-token')
      expect(fetch).toHaveBeenCalledWith('https://ghcr.io/token?scope=repository%3Anginx%2Fnginx-gateway-fabric%2Fnginx%3Apull', {
        headers: {},
      })
    })

    it('should include Basic auth header when credentials are present', async () => {
      jest
        .spyOn(ghcr as unknown as {getCredentials: () => unknown}, 'getCredentials')
        .mockReturnValue({username: 'ghuser', password: 'ghtoken'})
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))

      await (ghcr as unknown as {getToken: (r: string) => Promise<string>}).getToken('nginx/nginx-gateway-fabric/nginx')

      expect(fetch).toHaveBeenCalledWith('https://ghcr.io/token?scope=repository%3Anginx%2Fnginx-gateway-fabric%2Fnginx%3Apull', {
        headers: {Authorization: 'Basic Z2h1c2VyOmdodG9rZW4='},
      })
    })
  })

  describe('getImageInfo', () => {
    it('should return ImageMap from OCI image index, skipping unknown platform and applying variant rules', async () => {
      // fetch 1: token
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      // fetch 2: OCI index
      jest.mocked(fetch).mockResolvedValueOnce(
        mockResponse(OCI_INDEX, {
          'content-type': 'application/vnd.oci.image.index.v1+json',
          'docker-content-digest': 'sha256:indexdigest',
        }),
      )
      // fetch 3: amd64 layers
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(AMD64_LAYERS_MANIFEST))
      // fetch 4: arm64 layers
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(ARM64_LAYERS_MANIFEST))
      // fetch 5: arm/v7 layers
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(ARMV7_LAYERS_MANIFEST))

      const imageMap: ImageMap = await ghcr.getImageInfo({
        repository: 'nginx/nginx-gateway-fabric/nginx',
        tag: '2.3.0',
      })

      // unknown platform must be skipped
      expect(imageMap.size).toBe(3)

      // amd64 — no variant
      expect(imageMap.has('linux|amd64|')).toBe(true)
      const amd64 = imageMap.get('linux|amd64|')!
      expect(amd64.architecture).toBe('amd64')
      expect(amd64.os).toBe('linux')
      expect(amd64.variant).toBeUndefined()
      expect(amd64.digest).toBe('sha256:amd64digest')
      expect(amd64.layers).toEqual(['sha256:amd64layer1', 'sha256:amd64layer2'])

      // arm64 — no explicit variant in manifest, architecture is arm64, so variant must be 'v8'
      expect(imageMap.has('linux|arm64|v8')).toBe(true)
      const arm64 = imageMap.get('linux|arm64|v8')!
      expect(arm64.variant).toBe('v8')

      // arm/v7 — explicit variant preserved
      expect(imageMap.has('linux|arm|v7')).toBe(true)
      const armv7 = imageMap.get('linux|arm|v7')!
      expect(armv7.architecture).toBe('arm')
      expect(armv7.variant).toBe('v7')
      expect(armv7.layers).toEqual(['sha256:armv7layer1'])

      // token + OCI index + 3 platform layer fetches
      expect(fetch).toHaveBeenCalledTimes(5)
    })

    it('should return ImageMap from a single OCI manifest', async () => {
      // fetch 1: token
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      // fetch 2: single OCI manifest
      jest.mocked(fetch).mockResolvedValueOnce(
        mockResponse(SINGLE_MANIFEST, {
          'content-type': 'application/vnd.oci.image.manifest.v1+json',
          'docker-content-digest': 'sha256:ocioveralldigest',
        }),
      )
      // fetch 3: blob config
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(SINGLE_BLOB_CONFIG))
      // fetch 4: getLayers (fetches manifest by overall digest)
      jest.mocked(fetch).mockResolvedValueOnce(mockResponse(SINGLE_MANIFEST))

      const imageMap: ImageMap = await ghcr.getImageInfo({
        repository: 'myorg/myimage',
        tag: '1.0.0',
      })

      expect(imageMap.size).toBe(1)
      expect(imageMap.has('linux|amd64|')).toBe(true)
      const entry = imageMap.get('linux|amd64|')!
      expect(entry.architecture).toBe('amd64')
      expect(entry.os).toBe('linux')
      expect(entry.variant).toBeUndefined()
      expect(entry.digest).toBe('sha256:ocioveralldigest')
      expect(entry.layers).toEqual(['sha256:singlelayer1', 'sha256:singlelayer2'])

      // token + manifest + blob + getLayers
      expect(fetch).toHaveBeenCalledTimes(4)
    })
  })
})
