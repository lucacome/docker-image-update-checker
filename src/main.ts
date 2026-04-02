import * as core from '@actions/core'
import {ContainerRegistry} from './registry.js'
import {DockerHub} from './docker-hub.js'
import {GitHubContainerRegistry} from './github.js'
import {GoogleContainerRegistry} from './gcr.js'
import {QuayRegistry} from './quay.js'
import {AzureContainerRegistry} from './acr.js'
import {GoogleArtifactRegistry} from './artifact-registry.js'
import {ECRPublicRegistry, ECRPrivateRegistry} from './ecr.js'
import {getDiffs, parseImageInput} from './image-utils.js'
import {Util} from '@docker/actions-toolkit/lib/util.js'

/**
 * Returns the appropriate {@link ContainerRegistry} instance for the given registry hostname.
 * @throws {Error} if the registry is not supported
 */
function getRegistryInstance(registry: string): ContainerRegistry {
  const r = registry.toLowerCase()
  switch (r) {
    case 'docker.io':
      return new DockerHub()
    case 'ghcr.io':
      return new GitHubContainerRegistry()
    case 'gcr.io':
      return new GoogleContainerRegistry(r)
    case 'quay.io':
      return new QuayRegistry()
    case 'public.ecr.aws':
      return new ECRPublicRegistry()
    default:
      if (r.endsWith('.azurecr.io')) return new AzureContainerRegistry(r)
      if (r.endsWith('.pkg.dev')) return new GoogleArtifactRegistry(r)
      if (r.endsWith('.gcr.io')) return new GoogleContainerRegistry(r)
      if (r.endsWith('.amazonaws.com') && r.includes('.dkr.ecr.')) return new ECRPrivateRegistry(r)
      throw new Error(`Unsupported registry: ${registry}`)
  }
}

/**
 * Entry point for the GitHub Action. Reads inputs, compares base and target image layers
 * across platforms, and sets the `needs-updating`, `diff-images`, and `diff-json` outputs.
 */
export async function run(): Promise<void> {
  try {
    const baseInput = core.getInput('base-image')
    const imageInput = core.getInput('image')
    const platformsInput = Util.getInputList('platforms')

    core.startGroup('Inputs')
    core.info(`Base image: ${baseInput}`)
    core.info(`Image: ${imageInput}`)
    core.info(`Platforms: ${platformsInput}`)
    core.endGroup()

    const base = parseImageInput(baseInput)
    const image = parseImageInput(imageInput)

    const registryBase = getRegistryInstance(base.registry)
    const registryImage = getRegistryInstance(image.registry)

    const image1 = await registryBase.getImageInfo({
      repository: base.image,
      tag: base.tag,
    })
    const image2 = await registryImage.getImageInfo({
      repository: image.image,
      tag: image.tag,
    })

    const diffs = getDiffs(platformsInput, image1, image2)
    core.startGroup(`Found ${diffs.length} differences`)
    core.debug(`Differences: ${JSON.stringify(diffs, null, 2)}`)

    const diffPlatforms: string[] = []
    diffs.forEach((diff) => {
      const str = `${diff.os}/${diff.architecture}${diff.variant ? `/${diff.variant}` : ''}`
      core.info(`- ${str}`)
      diffPlatforms.push(str)
    })
    core.setOutput('diff-images', diffPlatforms.toString())
    core.endGroup()

    core.setOutput('diff-json', JSON.stringify(diffs))
    core.setOutput('needs-updating', diffs.length > 0)
  } catch (error) {
    core.setFailed(`Action failed with error: ${error instanceof Error ? error.message || String(error) : String(error)}`)
  }
}
