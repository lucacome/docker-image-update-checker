import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals'
import * as core from '@actions/core'
import {Util} from '@docker/actions-toolkit/lib/util.js'
import {getRegistryInstance, run} from '../src/main.js'
import {GenericRegistry} from '../src/generic-registry.js'
import {DockerHub} from '../src/docker-hub.js'
import {GitHubContainerRegistry} from '../src/github.js'
import {QuayRegistry} from '../src/quay.js'
import {ECRPublicRegistry, ECRPrivateRegistry} from '../src/ecr.js'
import {GitLabContainerRegistry} from '../src/gitlab.js'
import {DigitalOceanContainerRegistry} from '../src/digitalocean.js'
import {GoogleContainerRegistry} from '../src/gcr.js'
import {AzureContainerRegistry} from '../src/acr.js'
import {GoogleArtifactRegistry} from '../src/gar.js'
import {OracleContainerRegistry} from '../src/ocir.js'
import {mockResponse} from './registry-test-utils.js'

// ---------------------------------------------------------------------------
// Fixtures for run() tests
// ---------------------------------------------------------------------------

const TOKEN_RESPONSE = {token: 'test-token'}

const BASE_MANIFEST_LIST = {
  schemaVersion: 2,
  mediaType: 'application/vnd.docker.distribution.manifest.list.v2+json',
  manifests: [
    {
      mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
      digest: 'sha256:basedigest',
      size: 1000,
      platform: {architecture: 'amd64', os: 'linux'},
    },
  ],
}

const BASE_LAYERS_MANIFEST = {
  schemaVersion: 2,
  mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
  layers: [{digest: 'sha256:baselayer1'}, {digest: 'sha256:baselayer2'}],
}

const IMAGE_MANIFEST_LIST = {
  schemaVersion: 2,
  mediaType: 'application/vnd.docker.distribution.manifest.list.v2+json',
  manifests: [
    {
      mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
      digest: 'sha256:imagedigest',
      size: 1000,
      platform: {architecture: 'amd64', os: 'linux'},
    },
  ],
}

// All layers present in base → no update needed
const IMAGE_LAYERS_UP_TO_DATE = {
  schemaVersion: 2,
  mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
  layers: [{digest: 'sha256:baselayer1'}, {digest: 'sha256:baselayer2'}],
}

// Has a layer (oldlayer) not present in the current base → needs updating
const IMAGE_LAYERS_OUTDATED = {
  schemaVersion: 2,
  mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
  layers: [{digest: 'sha256:baselayer1'}, {digest: 'sha256:oldlayer'}],
}

function mockNotFoundResponse(): Response {
  return {
    ok: false,
    status: 404,
    statusText: 'Not Found',
    headers: {get: () => null, entries: () => [][Symbol.iterator]()},
    json: jest.fn(),
    text: jest.fn(),
  } as unknown as Response
}

function mockServerErrorResponse(): Response {
  return {
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    headers: {get: () => null, entries: () => [][Symbol.iterator]()},
    json: jest.fn(),
    text: jest.fn(),
  } as unknown as Response
}

describe('getRegistryInstance', () => {
  describe('DockerHub routing', () => {
    it('should route docker.io to DockerHub', () => {
      expect(getRegistryInstance('docker.io')).toBeInstanceOf(DockerHub)
    })

    it('should route index.docker.io to DockerHub', () => {
      expect(getRegistryInstance('index.docker.io')).toBeInstanceOf(DockerHub)
    })

    it('should route registry-1.docker.io to DockerHub', () => {
      expect(getRegistryInstance('registry-1.docker.io')).toBeInstanceOf(DockerHub)
    })
  })

  it('should route ghcr.io to GitHubContainerRegistry', () => {
    expect(getRegistryInstance('ghcr.io')).toBeInstanceOf(GitHubContainerRegistry)
  })

  it('should route quay.io to QuayRegistry', () => {
    expect(getRegistryInstance('quay.io')).toBeInstanceOf(QuayRegistry)
  })

  it('should route public.ecr.aws to ECRPublicRegistry', () => {
    expect(getRegistryInstance('public.ecr.aws')).toBeInstanceOf(ECRPublicRegistry)
  })

  it('should route *.dkr.ecr.*.amazonaws.com to ECRPrivateRegistry', () => {
    expect(getRegistryInstance('123456789.dkr.ecr.us-east-1.amazonaws.com')).toBeInstanceOf(ECRPrivateRegistry)
  })

  it('should route registry.gitlab.com to GitLabContainerRegistry', () => {
    expect(getRegistryInstance('registry.gitlab.com')).toBeInstanceOf(GitLabContainerRegistry)
  })

  it('should route registry.digitalocean.com to DigitalOceanContainerRegistry', () => {
    expect(getRegistryInstance('registry.digitalocean.com')).toBeInstanceOf(DigitalOceanContainerRegistry)
  })

  it('should route gcr.io to GoogleContainerRegistry', () => {
    expect(getRegistryInstance('gcr.io')).toBeInstanceOf(GoogleContainerRegistry)
  })

  it('should route *.gcr.io to GoogleContainerRegistry', () => {
    expect(getRegistryInstance('us.gcr.io')).toBeInstanceOf(GoogleContainerRegistry)
  })

  it('should route *.azurecr.io to AzureContainerRegistry', () => {
    expect(getRegistryInstance('myregistry.azurecr.io')).toBeInstanceOf(AzureContainerRegistry)
  })

  it('should route *.pkg.dev to GoogleArtifactRegistry', () => {
    expect(getRegistryInstance('us-docker.pkg.dev')).toBeInstanceOf(GoogleArtifactRegistry)
  })

  it('should route *.ocir.io to OracleContainerRegistry', () => {
    expect(getRegistryInstance('iad.ocir.io')).toBeInstanceOf(OracleContainerRegistry)
  })

  it('should route unknown hostname to GenericRegistry', () => {
    expect(getRegistryInstance('registry.example.com')).toBeInstanceOf(GenericRegistry)
  })

  it('should route mixed-case input case-insensitively to the correct registry', () => {
    expect(getRegistryInstance('Docker.IO')).toBeInstanceOf(DockerHub)
    expect(getRegistryInstance('GHCR.IO')).toBeInstanceOf(GitHubContainerRegistry)
    expect(getRegistryInstance('Quay.IO')).toBeInstanceOf(QuayRegistry)
  })
})

// ---------------------------------------------------------------------------
// run()
// ---------------------------------------------------------------------------

describe('run', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    jest.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'base-image') return 'nginx:latest'
      if (name === 'image') return 'user/app:latest'
      return ''
    })
    jest.spyOn(Util, 'getInputList').mockReturnValue(['all'])
    jest.spyOn(GenericRegistry.prototype as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should set needs-building=true and needs-updating=true when image does not exist', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      .mockResolvedValueOnce(
        mockResponse(BASE_MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}),
      )
      .mockResolvedValueOnce(mockResponse(BASE_LAYERS_MANIFEST, {'content-type': 'application/vnd.docker.distribution.manifest.v2+json'}))
      .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      .mockResolvedValueOnce(mockNotFoundResponse())

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('needs-building', true)
    expect(core.setOutput).toHaveBeenCalledWith('needs-updating', true)
    expect(core.setOutput).toHaveBeenCalledWith('diff-images', '')
    expect(core.setOutput).toHaveBeenCalledWith('diff-json', '[]')
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('should set needs-building=false when image exists and is up to date', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      .mockResolvedValueOnce(
        mockResponse(BASE_MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}),
      )
      .mockResolvedValueOnce(mockResponse(BASE_LAYERS_MANIFEST, {'content-type': 'application/vnd.docker.distribution.manifest.v2+json'}))
      .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      .mockResolvedValueOnce(
        mockResponse(IMAGE_MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}),
      )
      .mockResolvedValueOnce(
        mockResponse(IMAGE_LAYERS_UP_TO_DATE, {'content-type': 'application/vnd.docker.distribution.manifest.v2+json'}),
      )

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('needs-building', false)
    expect(core.setOutput).toHaveBeenCalledWith('needs-updating', false)
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('should set needs-building=false and needs-updating=true when image exists but is outdated', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      .mockResolvedValueOnce(
        mockResponse(BASE_MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}),
      )
      .mockResolvedValueOnce(mockResponse(BASE_LAYERS_MANIFEST, {'content-type': 'application/vnd.docker.distribution.manifest.v2+json'}))
      .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      .mockResolvedValueOnce(
        mockResponse(IMAGE_MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}),
      )
      .mockResolvedValueOnce(mockResponse(IMAGE_LAYERS_OUTDATED, {'content-type': 'application/vnd.docker.distribution.manifest.v2+json'}))

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('needs-building', false)
    expect(core.setOutput).toHaveBeenCalledWith('needs-updating', true)
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('should call setFailed when a non-404 error occurs fetching the image', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      .mockResolvedValueOnce(
        mockResponse(BASE_MANIFEST_LIST, {'content-type': 'application/vnd.docker.distribution.manifest.list.v2+json'}),
      )
      .mockResolvedValueOnce(mockResponse(BASE_LAYERS_MANIFEST, {'content-type': 'application/vnd.docker.distribution.manifest.v2+json'}))
      .mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE))
      .mockResolvedValueOnce(mockServerErrorResponse())

    await run()

    expect(core.setFailed).toHaveBeenCalled()
    expect(core.setOutput).not.toHaveBeenCalledWith('needs-building', expect.anything())
  })
})
