/** Client-side Imagine tool names (executed in ActivityController, not on xAI servers). */
export const IMAGE_CREATOR_TOOL_NAME = 'image_creator';
export const VIDEO_CREATOR_TOOL_NAME = 'video_creator';

export type ImageCreatorAction = 'generate' | 'edit' | 'edit_multi';

export type VideoCreatorMode =
    | 'text-to-video'
    | 'image-to-video'
    | 'reference-to-video'
    | 'edit-video'
    | 'extend-video';

export type ImagineMediaKind = 'image' | 'video';

export type ImagineMediaItem = {
    id: string;
    kind: ImagineMediaKind;
    url: string;
    prompt?: string;
    action?: ImageCreatorAction;
    mode?: VideoCreatorMode;
    duration?: number;
    respectModeration?: boolean;
    createdAt: string;
};

export type ThreadImagineMedia = {
    items: ImagineMediaItem[];
};

export type ImagineToolResult = {
    items: ImagineMediaItem[];
    error?: string;
};
