export type ThreadArtifact = {
    title: string;
    content: string;
    updatedAt: string;
    updatedBy: 'assistant' | 'user';
};

export const ARTIFACT_TOOL_NAME = 'artifact';
