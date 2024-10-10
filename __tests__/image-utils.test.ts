import {findDiffImages, parseImageInput, ImageInput, getDiffs} from '../src/image-utils'
import {ImageInfo, ImageMap} from '../src/registry'

describe('findDiffImages', () => {
  test('should return diff images when layers do not match', () => {
    const set1: ImageMap = new Map<string, ImageInfo>([
      [
        'linux/amd64',
        {
          os: 'linux',
          architecture: 'amd64',
          digest: 'digest1',
          layers: ['layer1', 'layer10', 'layer20', 'layer30'],
        },
      ],
      [
        'linux/arm64/v8',
        {
          os: 'linux',
          architecture: 'arm64',
          digest: 'digest2',
          layers: ['layer1', 'layer2', 'layer3', 'layer4'],
          variant: 'v8',
        },
      ],
    ])

    const set2: ImageMap = new Map<string, ImageInfo>([
      [
        'linux/amd64',
        {
          os: 'linux',
          architecture: 'amd64',
          digest: 'digest2',
          layers: ['layer1', 'layer2', 'layer3', 'layer4'],
        },
      ],
    ])

    const result = findDiffImages(set1, set2)
    expect(result).toEqual([
      {
        os: 'linux',
        architecture: 'amd64',
        digest: 'digest2',
        layers: ['layer1', 'layer2', 'layer3', 'layer4'],
      },
    ])
  })

  test('should not return diff images when all layers from obj1 are in obj2', () => {
    const set1: ImageMap = new Map<string, ImageInfo>([
      [
        'linux/arm64/v8',
        {
          os: 'linux',
          architecture: 'arm64',
          digest: 'digest1',
          layers: ['layer1', 'layer2', 'layer3'],
          variant: 'v8',
        },
      ],
    ])

    const set2: ImageMap = new Map<string, ImageInfo>([
      [
        'linux/arm64/v8',
        {
          os: 'linux',
          architecture: 'arm64',
          digest: 'digest2',
          layers: ['layer1', 'layer2', 'layer3', 'layer4'],
          variant: 'v8',
        },
      ],
    ])

    const result = findDiffImages(set1, set2)
    expect(result).toEqual([])
  })
})

describe('parseImageInput', () => {
  test('should parse image string with default registry and tag', () => {
    const imageString = 'nginx'
    const expectedResult: ImageInput = {
      registry: 'docker.io',
      image: 'library/nginx',
      tag: 'latest',
    }

    const result = parseImageInput(imageString)
    expect(result).toEqual(expectedResult)
  })

  test('should parse image string with custom registry and default tag', () => {
    const imageString = 'myregistry.example.com/nginx'
    const expectedResult: ImageInput = {
      registry: 'myregistry.example.com',
      image: 'nginx',
      tag: 'latest',
    }

    const result = parseImageInput(imageString)
    expect(result).toEqual(expectedResult)
  })

  test('should parse image string with custom registry, organization and default tag', () => {
    const imageString = 'myregistry.example.com/myorg/nginx'
    const expectedResult: ImageInput = {
      registry: 'myregistry.example.com',
      image: 'myorg/nginx',
      tag: 'latest',
    }

    const result = parseImageInput(imageString)
    expect(result).toEqual(expectedResult)
  })

  test('should parse image string with custom registry, organization, and tag', () => {
    const imageString = 'myregistry.example.com/myorg/nginx:1.0.0'
    const expectedResult: ImageInput = {
      registry: 'myregistry.example.com',
      image: 'myorg/nginx',
      tag: '1.0.0',
    }

    const result = parseImageInput(imageString)
    expect(result).toEqual(expectedResult)
  })

  test('should parse image string with default registry, organization, and custom tag', () => {
    const imageString = 'myorg/nginx:1.0.0'
    const expectedResult: ImageInput = {
      registry: 'docker.io',
      image: 'myorg/nginx',
      tag: '1.0.0',
    }

    const result = parseImageInput(imageString)
    expect(result).toEqual(expectedResult)
  })

  test('should parse image string with default registry and custom tag', () => {
    const imageString = 'nginx:1.0.0'
    const expectedResult: ImageInput = {
      registry: 'docker.io',
      image: 'library/nginx',
      tag: '1.0.0',
    }

    const result = parseImageInput(imageString)
    expect(result).toEqual(expectedResult)
  })
})

const image1: ImageMap = new Map([
  [
    'linux/amd64',
    {
      os: 'linux',
      architecture: 'amd64',
      digest: '123',
      layers: ['layer1', 'layer20', 'layer30'],
    },
  ],
  [
    'linux/arm64/v8',
    {
      os: 'linux',
      architecture: 'arm64',
      variant: 'v8',
      digest: '456',
      layers: ['layer1', 'layer20', 'layer30'],
    },
  ],
])

const image2: ImageMap = new Map([
  [
    'linux/amd64',
    {
      os: 'linux',
      architecture: 'amd64',
      digest: '789',
      layers: ['layer1', 'layer2', 'layer3', 'layer4'],
    },
  ],
  [
    'linux/arm64/v8',
    {
      os: 'linux',
      architecture: 'arm64',
      variant: 'v8',
      digest: '101112',
      layers: ['layer1', 'layer2', 'layer3', 'layer4'],
    },
  ],
])

describe('getDiffs', () => {
  test('should return all diff images when platforms is "all"', () => {
    const expectedResult: ImageInfo[] = [
      {
        os: 'linux',
        architecture: 'amd64',
        digest: '789',
        layers: ['layer1', 'layer2', 'layer3', 'layer4'],
      },
      {
        os: 'linux',
        architecture: 'arm64',
        variant: 'v8',
        digest: '101112',
        layers: ['layer1', 'layer2', 'layer3', 'layer4'],
      },
    ]

    const result = getDiffs(['all'], image1, image2)
    expect(result).toEqual(expectedResult)
  })

  test('should return diff images for specified platform', () => {
    const expectedResult: ImageInfo[] = [
      {
        os: 'linux',
        architecture: 'amd64',
        digest: '789',
        layers: ['layer1', 'layer2', 'layer3', 'layer4'],
      },
    ]

    const result = getDiffs(['linux/amd64'], image1, image2)
    expect(result).toEqual(expectedResult)
  })

  test('should return diff images for multiple specified platforms', () => {
    const expectedResult: ImageInfo[] = [
      {
        os: 'linux',
        architecture: 'amd64',
        digest: '789',
        layers: ['layer1', 'layer2', 'layer3', 'layer4'],
      },
      {
        os: 'linux',
        architecture: 'arm64',
        variant: 'v8',
        digest: '101112',
        layers: ['layer1', 'layer2', 'layer3', 'layer4'],
      },
    ]

    const result = getDiffs(['linux/amd64', 'linux/arm64'], image1, image2)
    expect(result).toEqual(expectedResult)
  })

  test('should return empty array when there are no diff images for specified platform', () => {
    const expectedResult: ImageInfo[] = []

    const result = getDiffs(['windows/amd64'], image1, image2)
    expect(result).toEqual(expectedResult)
  })
})
