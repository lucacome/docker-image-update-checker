import * as core from '@actions/core'
import {z} from 'zod'
import {DockerAuth} from './auth.js'

export interface Image {
  repository: string
  tag: string
}

// ─── OCI / Docker registry response schemas ───────────────────────────────────

/**
 * A single entry inside a manifest list / OCI image index.
 * `platform` is optional per the OCI image-index spec (nested indexes, referrer manifests, etc.)
 */
const ManifestEntrySchema = z.object({
  digest: z.string(),
  platform: z
    .object({
      architecture: z.string(),
      os: z.string(),
      variant: z.string().optional(),
    })
    .optional(),
})

/** Docker manifest list (schema v2) or OCI image index. */
const ManifestListSchema = z.object({
  manifests: z.array(ManifestEntrySchema),
})

/** Docker v2 / OCI single-platform manifest — only the fields we need. */
const SingleManifestSchema = z.object({
  config: z.object({
    digest: z.string(),
  }),
})

/** Blob config (image config JSON) — only the fields we need. */
const BlobConfigSchema = z.object({
  architecture: z.string(),
  os: z.string(),
  variant: z.string().optional(),
})

/** Manifest returned by a per-digest fetch — only the layers array. */
const LayersManifestSchema = z.object({
  layers: z.array(z.object({digest: z.string()})).optional(),
})

// ─── Inferred types ────────────────────────────────────────────────────────────

type ManifestList = z.infer<typeof ManifestListSchema>
type SingleManifest = z.infer<typeof SingleManifestSchema>
type BlobConfig = z.infer<typeof BlobConfigSchema>
type LayersManifest = z.infer<typeof LayersManifestSchema>

// ─── Shared helpers ────────────────────────────────────────────────────────────

interface FetchResult {
  headers: Record<string, string>
  data: unknown
}

export interface ImageInfo {
  os: string
  architecture: string
  variant?: string
  digest: string
  layers: string[]
}

export type ImageMap = Map<string, ImageInfo>

/** Generates a stable map key for an {@link ImageInfo} from its os, architecture, and variant. */
function generateKey(obj: ImageInfo): string {
  return [obj.os, obj.architecture, obj.variant || ''].join('|')
}

/**
 * Parses `data` with the given Zod schema and rethrows any ZodError as a plain Error
 * that includes the context URL and a human-readable issue summary.
 */
function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, url: string): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid registry response from ${url}: ${issues}`, {cause: result.error})
  }
  return result.data
}

// ─── Custom errors ─────────────────────────────────────────────────────────────

/** Thrown when a registry responds with HTTP 404 (image or tag not found). */
export class NotFoundError extends Error {
  constructor(url: string) {
    super(`Image not found: ${url}`)
    this.name = 'NotFoundError'
  }
}

// ─── Abstract base class ────────────────────────────────────────────────────────

/** Abstract base class for container registry clients. */
export abstract class ContainerRegistry {
  constructor(protected baseUrl: string) {}

  /** Returns a bearer token scoped to pull access for the given repository. */
  protected abstract getToken(repository: string): Promise<string>

  /** Returns stored Docker credentials for this registry, or undefined for anonymous access. */
  protected abstract getCredentials(): DockerAuth | undefined

  /**
   * Fetches the layer digests for the manifest identified by `digest`.
   */
  protected async getLayers(digest: string, repo: string, token: string): Promise<string[]> {
    const url = `https://${this.baseUrl}${repo}/manifests/${digest}`
    const headers = {
      Accept: 'application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
    }

    const fetchResult = await this.fetch(url, headers)
    const parsed: LayersManifest = parseOrThrow(LayersManifestSchema, fetchResult.data, url)
    return (parsed.layers ?? []).map((layer) => layer.digest)
  }

  /**
   * Performs a fetch against the registry API and returns parsed JSON along with response headers.
   * @throws {Error} on network failure, non-2xx status, or unparsable JSON response
   */
  protected async fetch(url: string, headers?: Record<string, string>): Promise<FetchResult> {
    let response: Response
    try {
      response = await globalThis.fetch(url, {headers})
    } catch (e) {
      throw new Error(`Failed to fetch ${url}: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
    }
    if (response.status === 404) {
      throw new NotFoundError(url)
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
    }
    let data: unknown
    try {
      data = await response.json()
    } catch (e) {
      throw new Error(
        `Failed to parse JSON response from ${url} (status: ${response.status}, content-type: ${response.headers.get('content-type')}): ${e instanceof Error ? e.message : String(e)}`,
        {cause: e},
      )
    }
    const headersObj = Object.fromEntries(response.headers.entries())
    if (core.isDebug()) {
      core.startGroup('Fetch response')
      core.info(`Fetching ${url}`)
      core.info(`Response status: ${response.status}`)
      core.info(`Response headers: ${JSON.stringify(headersObj, null, 2)}`)
      core.info(`Response data: ${JSON.stringify(data, null, 2)}`)
      core.endGroup()
    }
    return {
      headers: headersObj,
      data,
    }
  }

  /**
   * Fetches the manifest for the given image and returns a map of platform key → {@link ImageInfo},
   * including layer digests for each platform. Supports manifest lists, OCI image indexes,
   * and single-platform manifests.
   * @throws {Error} if the content type is unsupported or a required header/field is missing
   */
  async getImageInfo(image: Image): Promise<ImageMap> {
    core.debug(`Fetching token for repository: ${image.repository}`)
    const token = await this.getToken(image.repository)
    const url = `https://${this.baseUrl}${image.repository}/manifests/${image.tag}`
    const headers = {
      Accept:
        'application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
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
      const manifestList: ManifestList = parseOrThrow(ManifestListSchema, fetchResult.data, url)

      const imagesInfo = new Map<string, ImageInfo>()
      core.debug(`Initial imagesInfo: ${JSON.stringify(Array.from(imagesInfo.values()), null, 2)}`)
      for (const manifest of manifestList.manifests) {
        core.debug(`Processing manifest: ${JSON.stringify(manifest, null, 2)}`)
        // Skip entries with no platform (e.g. nested index entries) or unknown platform (e.g. BuildKit attestations)
        if (!manifest.platform || manifest.platform.architecture === 'unknown') {
          continue
        }
        const imageInfo = {
          architecture: manifest.platform.architecture,
          digest: manifest.digest,
          os: manifest.platform.os,
          variant: manifest.platform.variant ? manifest.platform.variant : manifest.platform.architecture === 'arm64' ? 'v8' : undefined,
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
      if (!dockerContentDigest) {
        throw new Error(`Missing docker-content-digest header for ${image.repository}:${image.tag}`)
      }
      const singleManifest: SingleManifest = parseOrThrow(SingleManifestSchema, fetchResult.data, url)
      const blobUrl = `https://${this.baseUrl}${image.repository}/blobs/${singleManifest.config.digest}`
      const blobHeaders = {
        Accept: 'application/vnd.docker.container.image.v1+json,application/vnd.oci.image.config.v1+json',
        ...(token ? {Authorization: `Bearer ${token}`} : {}),
      }
      const blobFetchResult = await this.fetch(blobUrl, blobHeaders)
      const blobConfig: BlobConfig = parseOrThrow(BlobConfigSchema, blobFetchResult.data, blobUrl)

      const {architecture, os, variant} = blobConfig
      core.debug(`Manifest for ${image.repository}:${image.tag}: ${JSON.stringify({architecture, os, variant}, null, 2)}`)

      const imageInfo = {
        architecture,
        digest: dockerContentDigest,
        os,
        variant: variant ? variant : architecture === 'arm64' ? 'v8' : undefined,
        layers: await this.getLayers(dockerContentDigest, image.repository, token),
      }
      core.debug(`Found image for ${image.repository}:${image.tag}: ${JSON.stringify(imageInfo)}`)

      return new Map([[generateKey(imageInfo), imageInfo]])
    } else {
      throw new Error(`Unsupported content type: ${contentType}`)
    }
  }
}
