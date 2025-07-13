/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type InferOptionType, type ISettingsManager, type PluginOptions } from "@utils/types";
import { useEffect, useState } from "react";

const settingsStore = new Map<string, Record<string, unknown>>();

export function definePluginSettings<T extends PluginOptions>(
    definition: T
): ISettingsManager<T> {
    return {
        definition,
        store: {} as { [K in keyof T]: InferOptionType<T[K]> },
    };
}

export function getPluginSettings(pluginId: string): Record<string, unknown> {
    if (!settingsStore.has(pluginId)) {
        const stored = localStorage.getItem(`plugin-settings:${pluginId}`);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                settingsStore.set(pluginId, parsed);
                return parsed;
            } catch {
                // return empty object
            }
        }
        settingsStore.set(pluginId, {});
    }
    return settingsStore.get(pluginId)!;
}

export function setPluginSetting(
    pluginId: string,
    key: string,
    value: unknown
): void {
    const settings = getPluginSettings(pluginId);
    settings[key] = value;
    localStorage.setItem(
        `plugin-settings:${pluginId}`,
        JSON.stringify(settings)
    );
    settingsStore.set(pluginId, settings);
    window.dispatchEvent(
        new CustomEvent("grok-settings-updated", {
            detail: { pluginId, key, value },
        })
    );
}

export function getPluginSetting<T extends PluginOptions, K extends keyof T & string>(
    pluginId: string,
    key: K,
    options: T,
    defaultValue?: InferOptionType<T[K]>
): InferOptionType<T[K]> {
    const settings = getPluginSettings(pluginId);
    const option = options[key];

    if (settings[key] !== undefined) {
        return settings[key] as InferOptionType<T[K]>;
    }

    if (option?.default !== undefined) {
        return option.default as InferOptionType<T[K]>;
    }

    return defaultValue as InferOptionType<T[K]>;
}

export function initializePluginSettings(
    pluginId: string,
    options: PluginOptions
): void {
    const settings = getPluginSettings(pluginId);
    let hasChanges = false;

    for (const [key, option] of Object.entries(options)) {
        if (settings[key] === undefined) {
            if (option.default !== undefined) {
                settings[key] = option.default;
                hasChanges = true;
            }
        } else {
            const storedType = typeof settings[key];
            const expectedType = option.type;
            if (storedType !== expectedType) {
                if (expectedType === "select" && option.options?.some(opt => opt.value === settings[key])) {
                } else {
                    console.warn(`Invalid type for plugin ${pluginId} setting ${key}: expected ${expectedType}, got ${storedType}. Resetting to default.`);
                    settings[key] = option.default;
                    hasChanges = true;
                }
            }
        }
    }

    if (hasChanges) {
        localStorage.setItem(
            `plugin-settings:${pluginId}`,
            JSON.stringify(settings)
        );
        settingsStore.set(pluginId, settings);
    }
}

export function useSetting<T extends PluginOptions, K extends keyof T & string>(
    pluginId: string,
    key: K
): [InferOptionType<T[K]>, (value: InferOptionType<T[K]>) => void] {
    const [value, setValue] = useState(getPluginSetting(pluginId, key, {} as T));
    useEffect(() => {
        const listener = (e: CustomEvent<{ pluginId: string; key: string; value: unknown; }>) => {
            if (e.detail.pluginId === pluginId && e.detail.key === key) {
                setValue(e.detail.value as InferOptionType<T[K]>);
            }
        };
        window.addEventListener("grok-settings-updated", listener as EventListener);
        return () => window.removeEventListener("grok-settings-updated", listener as EventListener);
    }, [pluginId, key]);
    const setter = (newValue: InferOptionType<T[K]>) => setPluginSetting(pluginId, key, newValue);
    return [value, setter];
}
