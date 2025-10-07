import { ImageInfo, ImageMap } from './registry.js';
export type ImageInput = {
    registry: string;
    image: string;
    tag: string;
};
export declare function findDiffImages(set1: ImageMap, set2: ImageMap): ImageInfo[];
export declare function parseImageInput(imageString: string): ImageInput;
export declare function getDiffs(platforms: string[], image1: ImageMap, image2: ImageMap): ImageInfo[];
//# sourceMappingURL=image-utils.d.ts.map