'use client';

import type { ImagineMediaItem, ThreadItem } from '@repo/shared/types';
import { imagineItemsFromThreadItem, isAllowedImagineMediaUrl } from '@repo/shared/utils';
import { Button, Dialog, DialogContent, cn } from '@repo/ui';
import { IconDownload, IconLinkOff, IconMaximize, IconPhoto, IconVideo } from '@tabler/icons-react';
import { memo, useCallback, useState } from 'react';
import { toast } from 'sonner';

function downloadFilename(item: ImagineMediaItem): string {
    const ext = item.kind === 'video' ? 'mp4' : 'png';
    return `groot-${item.kind}-${item.id.slice(0, 8)}.${ext}`;
}

async function downloadImagineMedia(item: ImagineMediaItem): Promise<void> {
    const filename = downloadFilename(item);

    if (item.url.startsWith('data:')) {
        const anchor = document.createElement('a');
        anchor.href = item.url;
        anchor.download = filename;
        anchor.click();
        return;
    }

    try {
        const response = await fetch(item.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
    } catch {
        const anchor = document.createElement('a');
        anchor.href = item.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.click();
        toast.message('Opened in a new tab — save the file manually if needed.');
    }
}

type MediaLightboxProps = {
    item: ImagineMediaItem | null;
    onClose: () => void;
};

const MediaLightbox = memo(({ item, onClose }: MediaLightboxProps) => {
    const [previewExpired, setPreviewExpired] = useState(false);

    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (!open) {
                setPreviewExpired(false);
                onClose();
            }
        },
        [onClose]
    );

    const handleDownload = useCallback(() => {
        if (!item) return;
        void downloadImagineMedia(item).catch(() => {
            toast.error('Download failed');
        });
    }, [item]);

    return (
        <Dialog open={item !== null} onOpenChange={handleOpenChange}>
            <DialogContent
                ariaTitle={item?.prompt ?? 'Generated media'}
                className="flex max-h-[92vh] w-[min(96vw,1100px)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0"
                closeButtonClassName="top-3 right-3"
            >
                {item && (
                    <>
                        <div className="border-border/70 flex items-center gap-2 border-b px-4 py-3 pr-14">
                            <div className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1.5 text-xs">
                                {item.kind === 'video' ? (
                                    <IconVideo size={14} strokeWidth={2} className="shrink-0" />
                                ) : (
                                    <IconPhoto size={14} strokeWidth={2} className="shrink-0" />
                                )}
                                <span className="truncate capitalize">{item.kind}</span>
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                size="xs"
                                className="shrink-0 gap-1.5"
                                disabled={previewExpired}
                                onClick={() => void handleDownload()}
                            >
                                <IconDownload size={14} strokeWidth={2} />
                                Download
                            </Button>
                        </div>

                        <div className="bg-muted/30 flex min-h-[200px] max-h-[calc(92vh-3.5rem)] flex-1 items-center justify-center overflow-auto p-3">
                            {previewExpired ? (
                                <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-12 text-center text-sm">
                                    <IconLinkOff size={24} strokeWidth={1.75} />
                                    <span>Link expired — the prompt is still shown below.</span>
                                </div>
                            ) : item.kind === 'video' ? (
                                <video
                                    src={item.url}
                                    controls
                                    autoPlay
                                    playsInline
                                    onError={() => setPreviewExpired(true)}
                                    className="max-h-[calc(92vh-5rem)] max-w-full rounded-md"
                                />
                            ) : (
                                <img
                                    src={item.url}
                                    alt={item.prompt ?? 'Generated image'}
                                    onError={() => setPreviewExpired(true)}
                                    className="max-h-[calc(92vh-5rem)] max-w-full object-contain"
                                />
                            )}
                        </div>

                        {item.prompt && (
                            <p className="text-muted-foreground border-border/70 shrink-0 break-words border-t px-4 py-3 text-xs leading-relaxed">
                                {item.prompt}
                            </p>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
});

MediaLightbox.displayName = 'MediaLightbox';

type MediaTileProps = {
    item: ImagineMediaItem;
    onOpen: (item: ImagineMediaItem) => void;
};

const MediaTile = memo(({ item, onOpen }: MediaTileProps) => {
    const [urlExpired, setUrlExpired] = useState(false);

    const onMediaError = useCallback(() => {
        setUrlExpired(true);
    }, []);

    const openLightbox = useCallback(() => {
        if (!urlExpired) onOpen(item);
    }, [item, onOpen, urlExpired]);

    return (
        <div className="border-border/60 bg-muted/20 overflow-hidden rounded-lg border">
            <div className="text-muted-foreground flex items-center gap-1.5 border-b border-border/50 px-2.5 py-1.5 text-xs">
                {item.kind === 'video' ? (
                    <IconVideo size={14} strokeWidth={2} />
                ) : (
                    <IconPhoto size={14} strokeWidth={2} />
                )}
                <span className="min-w-0 flex-1 truncate capitalize">{item.kind}</span>
                {item.mode && (
                    <span className="text-muted-foreground/80 truncate">
                        · {item.mode.replace(/-/g, ' ')}
                    </span>
                )}
                {!urlExpired && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-foreground -mr-1 h-6 w-6 shrink-0"
                        tooltip={item.kind === 'image' ? 'Enlarge' : 'Full screen'}
                        onClick={openLightbox}
                    >
                        <IconMaximize size={14} strokeWidth={2} />
                    </Button>
                )}
            </div>

            {urlExpired ? (
                <div className="bg-muted/40 text-muted-foreground flex min-h-[120px] flex-col items-center justify-center gap-2 px-4 py-6 text-center text-xs">
                    <IconLinkOff size={20} strokeWidth={1.75} />
                    <span>xAI link expired — the prompt below is still saved.</span>
                </div>
            ) : item.kind === 'video' ? (
                <video
                    src={item.url}
                    controls
                    playsInline
                    onError={onMediaError}
                    className={cn('bg-background max-h-[360px] w-full')}
                />
            ) : (
                <button
                    type="button"
                    className="bg-background block w-full cursor-zoom-in transition-opacity hover:opacity-90 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2"
                    onClick={openLightbox}
                    aria-label="Enlarge image"
                >
                    <img
                        src={item.url}
                        alt={item.prompt?.slice(0, 120) ?? 'Generated image'}
                        onError={onMediaError}
                        className="max-h-[360px] w-full object-contain"
                    />
                </button>
            )}

            {item.prompt && (
                <p className="text-muted-foreground min-h-0 shrink-0 break-words px-2.5 py-2 text-xs leading-relaxed">
                    {item.prompt}
                </p>
            )}
        </div>
    );
});

MediaTile.displayName = 'MediaTile';

export const ImagineMediaGallery = memo(
    ({ object }: { object?: ThreadItem['object'] }) => {
        const items = imagineItemsFromThreadItem({ object } as ThreadItem).filter(
            item => item.url.startsWith('data:') || isAllowedImagineMediaUrl(item.url)
        );
        const [lightboxItem, setLightboxItem] = useState<ImagineMediaItem | null>(null);

        if (items.length === 0) return null;

        return (
            <div className="flex w-full min-w-0 flex-col gap-2">
                <p className="text-muted-foreground text-xs font-medium">Generated media</p>
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    {items.map(item => (
                        <MediaTile key={item.id} item={item} onOpen={setLightboxItem} />
                    ))}
                </div>
                <MediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
            </div>
        );
    }
);

ImagineMediaGallery.displayName = 'ImagineMediaGallery';
