type LogContext = Record<string, unknown>;

export const logger = {
    debug: (message: string, context?: LogContext) => {
        if (process.env.NODE_ENV === 'development') {
            console.debug(message, context);
        }
    },
    info: (message: string, context?: LogContext) => {
        console.info(message, context);
    },
    warn: (message: string, context?: LogContext) => {
        console.warn(message, context);
    },
    error: (message: string, error?: unknown, context?: LogContext) => {
        console.error(message, error, context);
    },
};
