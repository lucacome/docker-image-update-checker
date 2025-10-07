import { DockerAuth } from './auth.js';
export interface Image {
    repository: string;
    tag: string;
}
interface Manifest {
    schemaVersion: number;
    mediaType: string;
    config: {
        mediaType: string;
        size: number;
        digest: string;
    };
    layers?: {
        mediaType: string;
        size: number;
        digest: string;
    }[];
    mainfests?: {
        mediaType: string;
        digest: string;
        size: number;
        platform: {
            architecture: string;
            os: string;
            variant?: string;
        };
    }[];
}
interface FetchResult {
    headers: Record<string, string>;
    data: Manifest;
}
export interface ImageInfo {
    os: string;
    architecture: string;
    variant?: string;
    digest: string;
    layers: string[];
}
export type ImageMap = Map<string, ImageInfo>;
export declare abstract class ContainerRegistry {
    protected baseUrl: string;
    constructor(baseUrl: string);
    protected abstract getToken(repository: string): Promise<string>;
    protected abstract getCredentials(): DockerAuth | undefined;
    protected getLayers(digest: string, repo: string, token: string): Promise<string[]>;
    protected fetch(url: string, headers?: Record<string, string>): Promise<FetchResult>;
    getImageInfo(image: Image): Promise<ImageMap>;
}
export {};
//# sourceMappingURL=registry.d.ts.map