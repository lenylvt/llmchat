import { ARTIFACT_TOOL_NAME } from '@repo/shared/types';

export { ARTIFACT_TOOL_NAME };

/** Client-side function tool — executed in ActivityController, not on xAI servers. */
export const ARTIFACT_FUNCTION_TOOL = {
    type: 'function' as const,
    name: ARTIFACT_TOOL_NAME,
    description:
        'Create or update the shared thread document in the side panel at any point in the conversation (including after other messages). Use for drafts, letters, templates, code, or long text the user should edit. Actions: create (new doc or reset title), replace (preferred — full document body), update (same as replace), delete (clear). Always include content with the complete document text on create/replace/update.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['create', 'update', 'replace', 'delete'],
                description: 'What to do with the thread document.',
            },
            title: {
                type: 'string',
                description: 'Short document title shown in the UI.',
            },
            content: {
                type: 'string',
                description: 'Full document body (plain text).',
            },
        },
        required: ['action'],
    },
};
