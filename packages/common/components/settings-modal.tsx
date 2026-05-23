'use client';
import { Alert, AlertDescription, DialogFooter } from '@repo/ui';
import { Button } from '@repo/ui/src/components/button';
import { IconBolt, IconKey, IconSettings2 } from '@tabler/icons-react';

import { Dialog, DialogContent, Input } from '@repo/ui';

import { useChatEditor } from '@repo/common/hooks';
import moment from 'moment';
import { useState } from 'react';
import { ApiKeys, useApiKeysStore } from '../store/api-keys.store';
import { SETTING_TABS, useAppStore } from '../store/app.store';
import { useChatStore } from '../store/chat.store';
import { ChatEditor } from './chat-input';
import { BYOKIcon } from './icons';

export const SettingsModal = () => {
    const isSettingOpen = useAppStore(state => state.isSettingsOpen);
    const setIsSettingOpen = useAppStore(state => state.setIsSettingsOpen);
    const settingTab = useAppStore(state => state.settingTab);
    const setSettingTab = useAppStore(state => state.setSettingTab);

    const settingMenu = [
        {
            icon: <IconSettings2 size={16} strokeWidth={2} className="text-muted-foreground" />,
            title: 'Customize',
            key: SETTING_TABS.PERSONALIZATION,
            component: <PersonalizationSettings />,
        },
        {
            icon: <IconKey size={16} strokeWidth={2} className="text-muted-foreground" />,
            title: 'API Keys',
            key: SETTING_TABS.API_KEYS,
            component: <ApiKeySettings />,
        },
    ];

    return (
        <Dialog open={isSettingOpen} onOpenChange={() => setIsSettingOpen(false)}>
            <DialogContent
                ariaTitle="Settings"
                className="h-full max-h-[600px] !max-w-[760px] overflow-x-hidden rounded-xl p-0"
            >
                <div className="no-scrollbar relative max-w-full overflow-y-auto overflow-x-hidden">
                    <h3 className="border-border mx-5 border-b py-4 text-lg font-bold">Settings</h3>
                    <div className="flex flex-row gap-6 p-4">
                        <div className="flex w-[160px] shrink-0 flex-col gap-1">
                            {settingMenu.map(setting => (
                                <Button
                                    key={setting.key}
                                    rounded="full"
                                    className="justify-start"
                                    variant={settingTab === setting.key ? 'secondary' : 'ghost'}
                                    onClick={() => setSettingTab(setting.key)}
                                >
                                    {setting.icon}
                                    {setting.title}
                                </Button>
                            ))}
                        </div>
                        <div className="flex flex-1 flex-col overflow-hidden px-4">
                            {settingMenu.find(setting => setting.key === settingTab)?.component}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export const ApiKeySettings = () => {
    const apiKeys = useApiKeysStore(state => state.getAllKeys());
    const setApiKey = useApiKeysStore(state => state.setKey);
    const [isEditing, setIsEditing] = useState<string | null>(null);

    const apiKeyList = [
        {
            name: 'xAI',
            key: 'XAI_API_KEY' as keyof ApiKeys,
            value: apiKeys.XAI_API_KEY,
            url: 'https://console.x.ai/',
        },
    ];

    const validateApiKey = (apiKey: string, provider: string) => {
        // Validation logic will be implemented later
        console.log(`Validating ${provider} API key: ${apiKey}`);
        return true;
    };

    const handleSave = (keyName: keyof ApiKeys, value: string) => {
        setApiKey(keyName, value);
        setIsEditing(null);
    };

    const getMaskedKey = (key: string) => {
        if (!key) return '';
        return '****************' + key.slice(-4);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col">
                <h2 className="flex items-center gap-1 text-base font-semibold">
                    API Keys <BYOKIcon />
                </h2>

                <p className="text-muted-foreground text-xs">
                    By default, your API Key is stored locally on your browser and never sent
                    anywhere else.
                </p>
            </div>

            {apiKeyList.map(apiKey => (
                <div key={apiKey.key} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{apiKey.name} API Key:</span>
                        <a
                            href={apiKey.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 underline-offset-2 hover:underline"
                        >
                            (Get API key here)
                        </a>
                    </div>

                    <div className="flex items-center gap-2">
                        {isEditing === apiKey.key ? (
                            <>
                                <div className="flex-1">
                                    <Input
                                        value={apiKey.value || ''}
                                        placeholder={`Enter ${apiKey.name} API key`}
                                        onChange={e => setApiKey(apiKey.key, e.target.value)}
                                    />
                                </div>
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleSave(apiKey.key, apiKey.value || '')}
                                >
                                    <span className="flex items-center gap-1">✓ Save</span>
                                </Button>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-1 items-center gap-2 rounded-md border px-3 py-1.5">
                                    {apiKey.value ? (
                                        <span className="flex-1">{getMaskedKey(apiKey.value)}</span>
                                    ) : (
                                        <span className="text-muted-foreground flex-1 text-sm">
                                            No API key set
                                        </span>
                                    )}
                                </div>
                                <Button
                                    variant={'bordered'}
                                    size="sm"
                                    onClick={() => setIsEditing(apiKey.key)}
                                >
                                    {apiKey.value ? 'Change Key' : 'Add Key'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

const MAX_CHAR_LIMIT = 6000;

export const PersonalizationSettings = () => {
    const customInstructions = useChatStore(state => state.customInstructions);
    const setCustomInstructions = useChatStore(state => state.setCustomInstructions);
    const { editor } = useChatEditor({
        charLimit: MAX_CHAR_LIMIT,
        defaultContent: customInstructions,
        placeholder: 'Enter your custom instructions',
        enableEnter: true,
        onUpdate(props) {
            setCustomInstructions(props.editor.getText());
        },
    });
    return (
        <div className="flex flex-col gap-1 pb-3">
            <h3 className="text-base font-semibold">Customize your AI Response</h3>
            <p className="text-muted-foreground text-sm">
                These instructions will be added to the beginning of every message.
            </p>
            <div className=" shadow-subtle-sm border-border mt-2 rounded-lg border p-3">
                <ChatEditor editor={editor} />
            </div>
        </div>
    );
};
