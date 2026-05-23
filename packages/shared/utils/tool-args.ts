export function stringArg(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key];
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export function numberArg(args: Record<string, unknown>, key: string): number | undefined {
    const value = args[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return undefined;
}

export function stringArrayArg(args: Record<string, unknown>, key: string, max = 10): string[] {
    const value = args[key];
    if (!Array.isArray(value)) return [];
    return value
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map(v => v.trim())
        .slice(0, max);
}
