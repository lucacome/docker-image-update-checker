import * as core from '@actions/core'
import {ContainerRegistry} from './registry'
import {DockerHub} from './docker-hub'
import {GitHubContainerRegistry} from './github'
import {getDiffs, parseImageInput} from './image-utils'
import {Util} from '@docker/actions-toolkit/lib/util'

function getRegistryInstance(registry: string): ContainerRegistry {
  switch (registry.toLowerCase()) {
    case 'docker.io':
      return new DockerHub()
    case 'ghcr.io':
      return new GitHubContainerRegistry()
    default:
      throw new Error(`Invalid registry specified: ${registry}`)
  }
}

async function run(): Promise<void> {
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
    core.setFailed(`Action failed with error: ${error}`)
  }
}

run()
