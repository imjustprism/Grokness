/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getPluginSetting, setPluginSetting } from "@utils/settings";
import { type IPlugin } from "@utils/types";
import { useCallback, useEffect, useState } from "react";

export const usePluginSettings = (
    plugin: IPlugin,
    onRestartChange?: (pluginName: string, requiresRestart: boolean) => void
) => {
    const [settingsState, setSettingsState] = useState<Record<string, unknown>>(() => {
        const initialSettings: Record<string, unknown> = {};
        for (const key in plugin.options) {
            initialSettings[key] = getPluginSetting(
                plugin.id,
                key,
                plugin.options
            );
        }
        return initialSettings;
    });

    const handleSettingUpdate = useCallback(
        (key: string, value: unknown) => {
            setPluginSetting(plugin.id, key, value);
            setSettingsState(prev => ({ ...prev, [key]: value }));
            if (onRestartChange && plugin.requiresRestart) {
                onRestartChange(plugin.name, true);
            }
        },
        [plugin.id, onRestartChange, plugin]
    );

    useEffect(() => {
        const handleSettingsEvent = (e: CustomEvent) => {
            if (e.detail.pluginId === plugin.id) {
                setSettingsState(prev => ({
                    ...prev,
                    [e.detail.key]: e.detail.value,
                }));
            }
        };

        window.addEventListener(
            "grok-settings-updated",
            handleSettingsEvent as EventListener
        );

        return () => {
            window.removeEventListener(
                "grok-settings-updated",
                handleSettingsEvent as EventListener
            );
        };
    }, [plugin.id]);

    return {
        settings: settingsState,
        handleSettingChange: handleSettingUpdate,
    };
};
