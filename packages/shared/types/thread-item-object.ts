import type { ThreadImagineMedia } from './imagine';

export type ClarifyingQuestion = {
    question?: string;
    options?: string[];
};

/** Persisted JSON on `thread_items.object` (artifact lives on `threads.artifact`). */
export type ThreadItemObject = {
    imagineMedia?: ThreadImagineMedia;
    clarifyingQuestion?: ClarifyingQuestion;
};
