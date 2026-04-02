import {ImageInfo, ImageMap} from './registry.js'
import * as core from '@actions/core'

export type ImageInput = {
  registry: string
  image: string
  tag: string
}

/**
 * Compares two ImageMaps and returns the entries from `set2` where not all layers of the
 * corresponding `set1` entry are present. A non-empty result means the image needs rebuilding.
 */
export function findDiffImages(set1: ImageMap, set2: ImageMap): ImageInfo[] {
  const diffImages: ImageInfo[] = []

  for (const [key, obj1] of set1) {
    const obj2 = set2.get(key)
    if (obj2) {
      const obj1LayersInObj2 = obj1.layers.every((layer) => obj2.layers.includes(layer))
      if (!obj1LayersInObj2) {
        diffImages.push(obj2)
      }
    }
  }

  if (core.isDebug()) {
    core.startGroup('Diff Images')
    core.info(`Diff Images: ${JSON.stringify(diffImages, null, 2)}`)
    core.endGroup()
  }

  return diffImages
}

/**
 * Parses a Docker image reference string into its registry, image path, and tag components.
 * Official Docker Hub images (e.g. `nginx`) are expanded to `library/nginx`.
 * Defaults to registry `docker.io` and tag `latest` when not specified.
 */
export function parseImageInput(imageString: string): ImageInput {
  const defaultRegistry = 'docker.io'

  const [registryAndImage, tag] = imageString.split(':')
  const parts = registryAndImage.split('/')
  const registry = (parts.length > 2 || parts[0].includes('.') ? parts.shift() : defaultRegistry) ?? defaultRegistry

  const isOfficialImage = registry === defaultRegistry && parts.length === 1
  const image = isOfficialImage ? `library/${parts.join('/')}` : parts.join('/')

  return {
    registry,
    image,
    tag: tag ?? 'latest',
  }
}

/**
 * Filters the diff results from {@link findDiffImages} to only the requested platforms.
 * Pass `['all']` to return every differing platform without filtering.
 * `arm64` platforms without an explicit variant are normalised to `arm64/v8`.
 */
export function getDiffs(platforms: string[], image1: ImageMap, image2: ImageMap): ImageInfo[] {
  const diffImages = findDiffImages(image1, image2)

  if (platforms.length === 1 && platforms[0] === 'all') {
    return diffImages
  } else {
    return diffImages.filter((diffImage) => {
      return platforms.some((platform) => {
        platform = platform.includes('arm64') && !platform.includes('v8') ? platform + '/v8' : platform

        return platform.includes(`${diffImage.os}/${diffImage.architecture}${diffImage.variant ? `/${diffImage.variant}` : ''}`)
      })
    })
  }
}
