import { ContainerRegistry } from './registry.js';
import { DockerAuth } from './auth.js';
export declare class GoogleContainerRegistry extends ContainerRegistry {
    constructor();
    getToken(repository: string): Promise<string>;
    getCredentials(): DockerAuth | undefined;
}
//# sourceMappingURL=gcr.d.ts.map