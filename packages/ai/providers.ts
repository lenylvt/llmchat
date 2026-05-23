import { createXai } from '@ai-sdk/xai';
import { ModelEnum } from './models';

declare global {
    interface Window {
        XAI_API_KEY?: string;
    }
}

let apiKeyOverride: string | undefined;

/** Inject API key before running workflows (Workers: call with env.XAI_API_KEY). */
export function setXaiApiKey(key: string | undefined) {
    apiKeyOverride = key?.trim() || undefined;
    if (typeof self !== 'undefined') {
        (self as { XAI_API_KEY?: string }).XAI_API_KEY = apiKeyOverride;
    }
}

export const getXaiApiKey = (): string => {
    if (apiKeyOverride) return apiKeyOverride;
    if (typeof process !== 'undefined' && process.env?.XAI_API_KEY) {
        return process.env.XAI_API_KEY;
    }
    if (typeof self !== 'undefined' && (self as { XAI_API_KEY?: string }).XAI_API_KEY) {
        return (self as { XAI_API_KEY?: string }).XAI_API_KEY || '';
    }
    if (typeof window !== 'undefined' && window.XAI_API_KEY) {
        return window.XAI_API_KEY;
    }
    return '';
};

export function getXai() {
    const apiKey = getXaiApiKey();
    if (!apiKey) {
        throw new Error('XAI_API_KEY is not configured');
    }
    return createXai({ apiKey });
}

export const getLanguageModel = (model: ModelEnum) => getXai().responses(model);
