/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getPluginSetting, type IPlugin, setPluginSetting, type SettingsUpdatedDetail } from "@utils/types";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Performs a shallow equality check on two settings maps
 */
const areSettingsEqual = (left: Record<string, unknown>, right: Record<string, unknown>): boolean => {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }
    for (const key of leftKeys) {
        if (left[key] !== right[key]) {
            return false;
        }
    }
    return true;
};

/**
 * React hook to read and update a plugin's settings with restart tracking.
 *
 * @param plugin - Plugin whose settings should be managed
 * @param onRestartChange - Optional callback to inform the UI that a restart is required based on changes
 */
export const usePluginSettings = (
    plugin: IPlugin,
    onRestartChange?: (pluginName: string, requiresRestart: boolean, source: "settings") => void
) => {
    const initialSettings = useMemo(() => {
        const map: Record<string, unknown> = {};
        for (const optionKey in plugin.options) {
            map[optionKey] = getPluginSetting(plugin.id, optionKey, plugin.options);
        }
        return map;
    }, [plugin]);

    const [settings, setSettings] = useState<Record<string, unknown>>(() => ({ ...initialSettings }));

    const handleSettingChange = useCallback(
        (key: string, value: unknown): void => {
            setPluginSetting(plugin.id, key, value);
            setSettings(previous => {
                const next = { ...previous, [key]: value };
                if (onRestartChange && plugin.requiresRestart) {
                    const requiresRestart = !areSettingsEqual(next, initialSettings);
                    onRestartChange(plugin.name, requiresRestart, "settings");
                }
                return next;
            });
        },
        [plugin, onRestartChange, initialSettings]
    );

    useEffect(() => {
        const listener = (event: CustomEvent<SettingsUpdatedDetail>): void => {
            if (event.detail.pluginId !== plugin.id) {
                return;
            }
            setSettings(previous => {
                const next = { ...previous, [event.detail.key]: event.detail.value };
                if (onRestartChange && plugin.requiresRestart) {
                    const requiresRestart = !areSettingsEqual(next, initialSettings);
                    onRestartChange(plugin.name, requiresRestart, "settings");
                }
                return next;
            });
        };
        window.addEventListener("grok-settings-updated", listener as unknown as EventListener);
        return () => window.removeEventListener("grok-settings-updated", listener as unknown as EventListener);
    }, [plugin.id, onRestartChange, plugin.requiresRestart, initialSettings]);

    return { settings, handleSettingChange } as const;
};
