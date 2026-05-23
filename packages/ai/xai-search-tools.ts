import type { ToolSet } from 'ai';
import type { getXai } from './providers';

/** Web + X search tools with image/video understanding (xAI docs). */
export function getXaiSearchTools(xai: ReturnType<typeof getXai>): ToolSet {
    return {
        web_search: xai.tools.webSearch({ enableImageUnderstanding: true }),
        x_search: xai.tools.xSearch({
            enableImageUnderstanding: true,
            enableVideoUnderstanding: true,
        }),
    } as ToolSet;
}
