import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// BetterAuth tables
export const user = sqliteTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const session = sqliteTable('session', {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
        .notNull()
        .references(() => user.id),
});

export const account = sqliteTable('account', {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
        .notNull()
        .references(() => user.id),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const verification = sqliteTable('verification', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// App tables
export const threads = sqliteTable('threads', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull().default('New Chat'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const threadItems = sqliteTable('thread_items', {
    id: text('id').primaryKey(),
    threadId: text('thread_id')
        .notNull()
        .references(() => threads.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    userId: text('user_id').notNull(),
    query: text('query').notNull(),
    answer: text('answer'),
    steps: text('steps'),
    sources: text('sources'),
    toolCalls: text('tool_calls'),
    toolResults: text('tool_results'),
    status: text('status').default('PENDING'),
    mode: text('mode').notNull(),
    metadata: text('metadata'),
    suggestions: text('suggestions'),
    imageAttachment: text('image_attachment'),
    fileAttachments: text('file_attachments'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const threadFiles = sqliteTable('thread_files', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    threadId: text('thread_id'),
    threadItemId: text('thread_item_id'),
    xaiFileId: text('xai_file_id').notNull(),
    filename: text('filename').notNull(),
    mediaType: text('media_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const schema = {
    user,
    session,
    account,
    verification,
    threads,
    threadItems,
    threadFiles,
};
