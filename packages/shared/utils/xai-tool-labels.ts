/** Human-readable labels for xAI server / function tool names (UI only). */
const FUNCTION_DISPLAY: Record<string, string> = {
    web_search: 'Web search',
    web_search_with_snippets: 'Web search (snippets)',
    browse_page: 'Browse page',
    x_search: 'X search',
    x_user_search: 'X user search',
    x_keyword_search: 'X keyword search',
    x_semantic_search: 'X semantic search',
    x_thread_fetch: 'X thread',
    code_execution: 'Code execution',
    code_interpreter: 'Code execution',
    file_search: 'File search',
    collections_search: 'File search',
    attachment_search: 'Attachment search',
    view_image: 'View image',
    view_x_video: 'View X video',
    mcp: 'MCP tool',
};

const CODE_FUNCTION_NAMES = new Set(['code_execution', 'code_interpreter']);

export function displayNameForServerTool(toolName: string): string {
    const key = toolName.trim();
    if (FUNCTION_DISPLAY[key]) return FUNCTION_DISPLAY[key];
    const lower = key.toLowerCase();
    if (FUNCTION_DISPLAY[lower]) return FUNCTION_DISPLAY[lower];
    if (CODE_FUNCTION_NAMES.has(lower)) return 'Code execution';
    if (lower.includes('mcp')) return 'MCP tool';
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
