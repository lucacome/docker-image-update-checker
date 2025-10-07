import { ContainerRegistry } from './registry.js';
import { DockerAuth } from './auth.js';
export declare class DockerHub extends ContainerRegistry {
    constructor();
    getToken(repository: string): Promise<string>;
    getCredentials(): DockerAuth | undefined;
}
//# sourceMappingURL=docker-hub.d.ts.map