import type { ToolSet } from 'ai';
import type { getXai } from './providers';

/** Web + X search + code execution (Vercel AI SDK path). */
export function getXaiSearchTools(xai: ReturnType<typeof getXai>): ToolSet {
    return {
        web_search: xai.tools.webSearch({ enableImageUnderstanding: true }),
        x_search: xai.tools.xSearch({
            enableImageUnderstanding: true,
            enableVideoUnderstanding: true,
        }),
        code_execution: xai.tools.codeExecution(),
    } as ToolSet;
}
