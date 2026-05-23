export type ParsedToolCallArgs = {
    args: Record<string, unknown>;
    incomplete: boolean;
};

/** Shared JSON parsing for xAI function-call argument strings and objects. */
export function parseToolCallArguments(raw: unknown): ParsedToolCallArgs {
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw) as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return { args: parsed as Record<string, unknown>, incomplete: false };
            }
        } catch {
            return { args: { raw }, incomplete: true };
        }
    }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return { args: raw as Record<string, unknown>, incomplete: false };
    }
    return { args: {}, incomplete: false };
}
