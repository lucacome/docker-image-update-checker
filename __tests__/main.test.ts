import {describe, it, expect} from '@jest/globals'
import {getRegistryInstance} from '../src/main.js'
import {DockerHub} from '../src/docker-hub.js'
import {GitHubContainerRegistry} from '../src/github.js'
import {QuayRegistry} from '../src/quay.js'
import {ECRPublicRegistry, ECRPrivateRegistry} from '../src/ecr.js'
import {GitLabContainerRegistry} from '../src/gitlab.js'
import {DigitalOceanContainerRegistry} from '../src/digitalocean.js'
import {GoogleContainerRegistry} from '../src/gcr.js'
import {AzureContainerRegistry} from '../src/acr.js'
import {GoogleArtifactRegistry} from '../src/gar.js'
import {OCIRegistry} from '../src/ocir.js'
import {GenericRegistry} from '../src/generic-registry.js'

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

  it('should route *.ocir.io to OCIRegistry', () => {
    expect(getRegistryInstance('iad.ocir.io')).toBeInstanceOf(OCIRegistry)
  })

  it('should route unknown hostname to GenericRegistry', () => {
    expect(getRegistryInstance('registry.example.com')).toBeInstanceOf(GenericRegistry)
  })
})
