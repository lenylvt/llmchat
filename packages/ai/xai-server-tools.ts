/**
 * xAI server-side agentic tools — output item types and function names.
 * @see https://docs.x.ai/developers/tools/tool-usage-details
 */

export type XaiSearchToolCategory = 'web_search' | 'x_search';

/** Known Responses API `output[].type` values for server-side tools. */
export const XAI_SERVER_TOOL_OUTPUT_TYPES = new Set([
    'web_search_call',
    'x_search_call',
    'code_interpreter_call',
    'file_search_call',
    'mcp_call',
    'attachment_search_call',
]);

const WEB_FUNCTION_NAMES = new Set([
    'web_search',
    'web_search_with_snippets',
    'browse_page',
]);

const X_FUNCTION_NAMES = new Set([
    'x_search',
    'x_user_search',
    'x_keyword_search',
    'x_semantic_search',
    'x_thread_fetch',
]);

const OUTPUT_TYPE_DEFAULT_NAME: Record<string, string> = {
    web_search_call: 'web_search',
    x_search_call: 'x_search',
    code_interpreter_call: 'code_execution',
    file_search_call: 'file_search',
    mcp_call: 'mcp',
    attachment_search_call: 'attachment_search',
};

/** Client-side tools — shown if present but not executed on xAI servers. */
export function isClientToolOutputType(itemType: string): boolean {
    return itemType === 'function_call';
}

export function isServerToolOutputType(itemType: string): boolean {
    if (!itemType || isClientToolOutputType(itemType)) return false;
    return XAI_SERVER_TOOL_OUTPUT_TYPES.has(itemType);
}

export function isSearchToolOutputType(itemType: string): boolean {
    return itemType === 'web_search_call' || itemType === 'x_search_call';
}

export function searchCategoryFromOutputType(itemType: string): XaiSearchToolCategory | null {
    if (itemType === 'web_search_call') return 'web_search';
    if (itemType === 'x_search_call') return 'x_search';
    return null;
}

export function searchCategoryFromFunctionName(name: string): XaiSearchToolCategory | null {
    const n = name.trim().toLowerCase();
    if (WEB_FUNCTION_NAMES.has(n)) return 'web_search';
    if (X_FUNCTION_NAMES.has(n)) return 'x_search';
    return null;
}

export function defaultNameFromOutputType(itemType: string): string {
    if (OUTPUT_TYPE_DEFAULT_NAME[itemType]) return OUTPUT_TYPE_DEFAULT_NAME[itemType];
    return itemType;
}

export function resolveServerToolName(
    item: Record<string, unknown>,
    itemType: string
): string {
    if (typeof item.name === 'string' && item.name.trim()) {
        return item.name.trim();
    }
    const fn = item.function;
    if (fn && typeof fn === 'object') {
        const name = (fn as { name?: unknown }).name;
        if (typeof name === 'string' && name.trim()) return name.trim();
    }
    return defaultNameFromOutputType(itemType);
}

export function isSearchRelatedToolName(toolName: string): boolean {
    return searchCategoryFromFunctionName(toolName) !== null;
}
