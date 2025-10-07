import { ContainerRegistry } from './registry.js';
import { DockerAuth } from './auth.js';
export declare class GitHubContainerRegistry extends ContainerRegistry {
    constructor();
    getToken(repository: string): Promise<string>;
    getCredentials(): DockerAuth | undefined;
}
//# sourceMappingURL=github.d.ts.map