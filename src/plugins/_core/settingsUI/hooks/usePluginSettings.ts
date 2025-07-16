/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getPluginSetting, setPluginSetting } from "@utils/settings";
import { type IPlugin } from "@utils/types";
import { useCallback, useEffect, useMemo, useState } from "react";

const areSettingsEqual = (settingsA: Record<string, unknown>, settingsB: Record<string, unknown>): boolean => {
    const keysA = Object.keys(settingsA);
    const keysB = Object.keys(settingsB);
    if (keysA.length !== keysB.length) {
        return false;
    }
    return keysA.every(key => settingsA[key] === settingsB[key]);
};

export const usePluginSettings = (
    plugin: IPlugin,
    onRestartChange?: (pluginName: string, requiresRestart: boolean, source: "settings") => void
) => {
    const initialSettingsMap = useMemo(() => {
        const settingsMap: Record<string, unknown> = {};
        for (const settingKey in plugin.options) {
            settingsMap[settingKey] = getPluginSetting(plugin.id, settingKey, plugin.options);
        }
        return settingsMap;
    }, [plugin]);

    const [currentSettings, setCurrentSettings] = useState(() => ({ ...initialSettingsMap }));

    const updateSettingValue = useCallback(
        (settingKey: string, newValue: unknown) => {
            setPluginSetting(plugin.id, settingKey, newValue);
            setCurrentSettings(prevSettings => {
                const updatedSettings = { ...prevSettings, [settingKey]: newValue };
                if (onRestartChange && plugin.requiresRestart) {
                    const isRestartRequired = !areSettingsEqual(updatedSettings, initialSettingsMap);
                    onRestartChange(plugin.name, isRestartRequired, "settings");
                }
                return updatedSettings;
            });
        },
        [plugin, onRestartChange, initialSettingsMap]
    );

    useEffect(() => {
        const handleSettingsUpdateEvent = (event: CustomEvent) => {
            if (event.detail.pluginId === plugin.id) {
                setCurrentSettings(prevSettings => {
                    const updatedSettings = { ...prevSettings, [event.detail.key]: event.detail.value };
                    if (onRestartChange && plugin.requiresRestart) {
                        const isRestartRequired = !areSettingsEqual(updatedSettings, initialSettingsMap);
                        onRestartChange(plugin.name, isRestartRequired, "settings");
                    }
                    return updatedSettings;
                });
            }
        };

        window.addEventListener("grok-settings-updated", handleSettingsUpdateEvent as EventListener);

        return () => {
            window.removeEventListener("grok-settings-updated", handleSettingsUpdateEvent as EventListener);
        };
    }, [plugin.id, onRestartChange, initialSettingsMap]);

    return {
        settings: currentSettings,
        handleSettingChange: updateSettingValue,
    };
};
