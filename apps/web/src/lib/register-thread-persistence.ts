import { registerThreadPersistence } from '@repo/common/store/thread-persistence';
import {
    createThreadFn,
    deleteThreadFn,
    deleteThreadItemFn,
    getThreadFn,
    getThreadItemsFn,
    getThreadsFn,
    updateThreadArtifactFn,
    updateThreadFn,
    upsertThreadItemFn,
} from '../server/threads';

export function registerAppThreadPersistence() {
    registerThreadPersistence({
        getThreads: () => getThreadsFn(),
        getThread: threadId => getThreadFn({ data: threadId }),
        createThread: input => createThreadFn({ data: input }),
        updateThread: input => updateThreadFn({ data: input }),
        updateThreadArtifact: input => updateThreadArtifactFn({ data: input }),
        deleteThread: threadId => deleteThreadFn({ data: threadId }),
        getThreadItems: threadId => getThreadItemsFn({ data: threadId }),
        upsertThreadItem: item => upsertThreadItemFn({ data: item }),
        deleteThreadItem: itemId => deleteThreadItemFn({ data: itemId }),
    });
}
