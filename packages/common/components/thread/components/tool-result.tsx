import { CodeBlock, ToolResultIcon } from '@repo/common/components';
import { ToolResult as ToolResultType } from '@repo/shared/types';
import { Badge, cn } from '@repo/ui';
import { IconCaretDownFilled } from '@tabler/icons-react';
import { memo, useCallback, useId, useState } from 'react';

export type ToolResultProps = {
    toolResult: ToolResultType;
};

export const ToolResultStep = memo(({ toolResult }: ToolResultProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const contentId = useId();
    const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);

    return (
        <div className="flex w-full min-w-0 flex-col items-start overflow-hidden rounded-lg border border-border/60 bg-muted/20">
            <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={contentId}
                className={cn(
                    'flex min-h-10 w-full cursor-pointer flex-row items-center justify-between gap-2 px-3 py-2',
                    'transition-transform transition-colors hover:bg-muted/40 active:scale-[0.96] motion-reduce:active:scale-100',
                    'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2'
                )}
                onClick={toggleOpen}
            >
                <div className="flex min-w-0 flex-row items-center gap-2">
                    <ToolResultIcon />
                    <Badge variant="outline" className="tabular-nums">
                        Result
                    </Badge>
                    <Badge variant="secondary" className="max-w-[160px] truncate">
                        {toolResult.toolName}
                    </Badge>
                </div>
                <IconCaretDownFilled
                    size={14}
                    strokeWidth={2}
                    className={cn(
                        'text-muted-foreground shrink-0 transition-transform duration-200',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>
            {isOpen && (
                <div id={contentId} className="w-full border-t border-border/50 px-3 pb-3 pt-1">
                    <CodeBlock
                        variant="secondary"
                        showHeader={false}
                        lang="json"
                        className="my-1 max-h-64 overflow-auto"
                        code={JSON.stringify(toolResult.result, null, 2)}
                    />
                </div>
            )}
        </div>
    );
});

ToolResultStep.displayName = 'ToolResultStep';
