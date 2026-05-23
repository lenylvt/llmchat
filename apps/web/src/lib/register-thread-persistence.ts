import { registerThreadPersistence } from '@repo/common/store/thread-persistence';
import {
    createThreadFn,
    deleteThreadFn,
    deleteThreadItemFn,
    getThreadFn,
    getThreadItemsFn,
    getThreadsFn,
    updateThreadFn,
    upsertThreadItemFn,
} from '../server/threads';

export function registerAppThreadPersistence() {
    registerThreadPersistence({
        getThreads: () => getThreadsFn(),
        getThread: threadId => getThreadFn({ data: threadId }),
        createThread: input => createThreadFn({ data: input }),
        updateThread: input => updateThreadFn({ data: input }),
        deleteThread: threadId => deleteThreadFn({ data: threadId }),
        getThreadItems: threadId => getThreadItemsFn({ data: threadId }),
        upsertThreadItem: item => upsertThreadItemFn({ data: item }),
        deleteThreadItem: itemId => deleteThreadItemFn({ data: itemId }),
    });
}
