import axios, {AxiosError} from 'axios'
import * as core from '@actions/core'
import {DockerAuth} from './auth'

export interface Image {
  repository: string
  tag: string
}

interface Manifest {
  schemaVersion: number
  mediaType: string
  config: {
    mediaType: string
    size: number
    digest: string
  }
  layers?: {
    mediaType: string
    size: number
    digest: string
  }[]
  mainfests?: {
    mediaType: string
    digest: string
    size: number
    platform: {
      architecture: string
      os: string
      variant?: string
    }
  }[]
}

interface FetchResult {
  headers: Record<string, string>
  data: Manifest
}

export interface ImageInfo {
  os: string
  architecture: string
  variant?: string
  digest: string
  layers: string[]
}

export type ImageMap = Map<string, ImageInfo>

function generateKey(obj: ImageInfo): string {
  return [obj.os, obj.architecture, obj.variant || ''].join('|')
}

function convertHeaders(headers: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      result[key] = value
    }
  }
  return result
}

export abstract class ContainerRegistry {
  constructor(protected baseUrl: string) {}

  protected abstract getToken(repository: string): Promise<string>

  protected abstract getCredentials(): DockerAuth | undefined

  protected async getLayers(digest: string, repo: string, token: string): Promise<string[]> {
    const url = `https://${this.baseUrl}${repo}/manifests/${digest}`
    const headers = {
      Accept: 'application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json',
      Authorization: `Bearer ${token}`,
    }

    const fetchResult = await this.fetch(url, headers)

    const layers = fetchResult.data.layers as unknown as {digest: string}[]

    return layers.map((layer) => layer.digest)
  }

  protected async fetch(url: string, headers?: Record<string, string>): Promise<FetchResult> {
    try {
      const response = await axios.get<Manifest>(url, {headers})
      if (core.isDebug()) {
        core.startGroup('Fetch response')
        core.info(`Fetching ${url}`)
        core.info(`Response status: ${response.status}`)
        core.info(`Response headers: ${JSON.stringify(response.headers, null, 2)}`)
        core.info(`Response data: ${JSON.stringify(response.data, null, 2)}`)
        core.endGroup()
      }
      return {
        headers: convertHeaders(response.headers),
        data: response.data,
      }
    } catch (error) {
      if (error instanceof Error) {
        const axiosError = error as AxiosError
        if (axiosError.response) {
          throw new Error(`Failed to fetch ${url}: ${axiosError.response.status} ${axiosError.response.statusText}`)
        }
        throw error
      }
      throw new Error('Unknown error occurred during fetch')
    }
  }

  async getImageInfo(image: Image): Promise<ImageMap> {
    core.debug(`Fetching token for repository: ${image.repository}`)
    const token = await this.getToken(image.repository)
    const url = `https://${this.baseUrl}${image.repository}/manifests/${image.tag}`
    const headers = {
      Accept:
        'application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json',
      Authorization: `Bearer ${token}`,
    }

    core.debug(`Fetching manifest for image: ${image.repository}:${image.tag}`)
    const fetchResult = await this.fetch(url, headers)
    const contentType = fetchResult.headers['content-type']
    const dockerContentDigest = fetchResult.headers['docker-content-digest']

    core.debug(`Content type: ${contentType}`)
    core.debug(`Docker content digest: ${dockerContentDigest}`)

    if (
      contentType === 'application/vnd.docker.distribution.manifest.list.v2+json' ||
      contentType === 'application/vnd.oci.image.index.v1+json'
    ) {
      core.debug(`Processing manifest list for image: ${image.repository}:${image.tag}`)
      const manifestList = fetchResult.data as unknown as {
        manifests: {
          digest: string
          platform: {
            architecture: string
            os: string
            variant: string
          }
        }[]
      }

      const imagesInfo = new Map<string, ImageInfo>()
      core.debug(`Initial imagesInfo: ${JSON.stringify(Array.from(imagesInfo.values()), null, 2)}`)
      for (const manifest of manifestList.manifests) {
        core.debug(`Processing manifest: ${JSON.stringify(manifest, null, 2)}`)
        if (manifest.platform.architecture === 'unknown') {
          continue
        }
        const imageInfo = {
          architecture: manifest.platform.architecture,
          digest: manifest.digest,
          os: manifest.platform?.os,
          variant: manifest.platform?.variant ? manifest.platform.variant : manifest.platform.architecture === 'arm64' ? 'v8' : undefined,
          layers: await this.getLayers(manifest.digest, image.repository, token),
        }
        core.debug(`Generated imageInfo: ${JSON.stringify(imageInfo, null, 2)}`)
        imagesInfo.set(generateKey(imageInfo), imageInfo)
      }
      core.debug(`Found ${imagesInfo.size} images in manifest list for ${image.repository}:${image.tag}`)
      core.debug(`Images: ${JSON.stringify(Array.from(imagesInfo.values()), null, 2)}`)
      return imagesInfo
    } else if (
      contentType === 'application/vnd.docker.distribution.manifest.v2+json' ||
      contentType === 'application/vnd.oci.image.manifest.v1+json'
    ) {
      core.debug(`Processing single manifest for image: ${image.repository}:${image.tag}`)
      const digest = fetchResult.data.config.digest
      const blobUrl = `https://${this.baseUrl}${image.repository}/blobs/${digest}`
      const blobHeaders = {
        Accept: 'application/vnd.docker.container.image.v1+json,application/vnd.oci.image.config.v1+json',
        Authorization: `Bearer ${token}`,
      }
      const blobFetchResult = await this.fetch(blobUrl, blobHeaders)

      const {architecture, os, variant} = blobFetchResult.data as unknown as {
        architecture: string
        os: string
        variant: string
      }
      const manifest = {architecture, os, variant}
      core.debug(`Manifest for ${image.repository}:${image.tag}: ${JSON.stringify(manifest, null, 2)}`)

      const imageInfo = {
        architecture: manifest.architecture,
        digest: dockerContentDigest,
        os: manifest.os,
        variant: manifest.variant ? manifest.variant : manifest.architecture === 'arm64' ? 'v8' : undefined,
        layers: await this.getLayers(dockerContentDigest, image.repository, token),
      }
      core.debug(`Found image for ${image.repository}:${image.tag}: ${JSON.stringify(imageInfo)}`)

      return new Map([[generateKey(imageInfo), imageInfo]])
    } else {
      throw new Error('Unsupported content type')
    }
  }
}
