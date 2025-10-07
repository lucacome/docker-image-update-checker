import {ImageInfo, ImageMap} from './registry.js'
import * as core from '@actions/core'

export type ImageInput = {
  registry: string
  image: string
  tag: string
}

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
    core.info(`Diff Images: ${(JSON.stringify(diffImages), null, 2)}`)
    core.endGroup()
  }

  return diffImages
}

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
