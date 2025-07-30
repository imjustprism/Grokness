/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Modal } from "@components/Modal";
import { Switch } from "@components/Switch";
import { InputField } from "@plugins/_core/settingsUI/components/InputField";
import { usePluginSettings } from "@plugins/_core/settingsUI/hooks/usePluginSettings";
import { Logger } from "@utils/logger";
import type { InferOptionType, IPlugin, PluginOptionBase, PluginOptions } from "@utils/types";
import clsx from "clsx";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CARD_HEIGHT = 120;
const CARD_BORDER_WIDTH = 1;

const pluginCardLogger = new Logger("PluginCard", "#f5c2e7");

export interface PluginCardProps {
    plugin: IPlugin;
    borderSize?: number;
    cardWidth?: string;
    borderRadius?: string;
    onToggle?: (pluginName: string, isDisabled: boolean) => void;
    onRestartChange?: (pluginName: string, requiresRestart: boolean, source: "toggle" | "settings") => void;
}

export const PluginCard: React.FC<PluginCardProps> = ({
    plugin,
    borderSize = CARD_BORDER_WIDTH,
    cardWidth = "w-full",
    borderRadius = "rounded-xl",
    onToggle,
    onRestartChange,
}) => {
    const [showModal, setShowModal] = useState(false);
    const { settings, handleSettingChange } = usePluginSettings(plugin, onRestartChange);
    const debounceTimer = useRef<number | null>(null);

    const pluginStorageKey = `plugin-enabled:${plugin.id}`;
    const initialEnabled = useMemo(() => !!localStorage.getItem(pluginStorageKey), [pluginStorageKey]);
    const [isEnabled, setIsEnabled] = useState(initialEnabled);

    const hasSettings = Object.keys(plugin.options).length > 0;

    const sortedOptions = useMemo(() => {
        const typeOrder: Record<string, number> = { select: 0, string: 1, number: 2, custom: 3, boolean: 4 };
        return Object.entries(plugin.options).sort(([, a], [, b]) => {
            const orderA = typeOrder[a.type] ?? 99;
            const orderB = typeOrder[b.type] ?? 99;
            return orderA - orderB;
        });
    }, [plugin.options]);

    const handleToggleChange = useCallback((checked: boolean) => {
        if (plugin.required) {
            return;
        }

        setIsEnabled(checked);
        onToggle?.(plugin.name, !checked);

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = window.setTimeout(() => {
            try {
                if (checked) {
                    localStorage.setItem(pluginStorageKey, "1");
                    if (plugin.start) {
                        plugin.start({ storageKey: pluginStorageKey });
                    } else {
                        pluginCardLogger.warn(`Plugin "${plugin.name}" has no start method.`);
                    }
                } else {
                    localStorage.removeItem(pluginStorageKey);
                    if (plugin.stop) {
                        plugin.stop({ storageKey: pluginStorageKey });
                    } else {
                        pluginCardLogger.warn(`Plugin "${plugin.name}" has no stop method.`);
                    }
                }
            } catch (error) {
                pluginCardLogger.error(`Error toggling plugin "${plugin.name}":`, error);
            }

            if (onRestartChange && plugin.requiresRestart) {
                const requiresRestart = checked !== initialEnabled;
                onRestartChange(plugin.name, requiresRestart, "toggle");
            }
        }, 250);
    }, [plugin, pluginStorageKey, onToggle, onRestartChange, initialEnabled]);

    useEffect(() => {
        const storageListener = (e: StorageEvent) => {
            if (e.key === pluginStorageKey && !plugin.required) {
                setIsEnabled(!!e.newValue);
            }
        };
        window.addEventListener("storage", storageListener);
        return () => window.removeEventListener("storage", storageListener);
    }, [pluginStorageKey, plugin.required]);

    useEffect(() => {
        if (plugin.required && !isEnabled) {
            setIsEnabled(true);
        }
    }, [plugin.required, isEnabled]);

    const switchLabelId = useMemo(() => `plugin-switch-${plugin.id}`, [plugin.id]);

    const handleSettingUpdate = useCallback(<K extends keyof PluginOptions>(
        key: K,
        value: InferOptionType<PluginOptions[K]>
    ) => {
        handleSettingChange(key as string, value);
    }, [handleSettingChange]);

    const renderSettingControl = (key: string, option: PluginOptionBase, currentValue: unknown) => {
        const labelId = `setting-label-${plugin.id}-${key}`;

        if (option.type === "boolean") {
            return (
                <div className="flex justify-between items-center">
                    <div className="flex flex-col flex-1 pr-4">
                        <label id={labelId} className="text-sm font-medium text-primary">{option.displayName || key}</label>
                        {option.description && <p className="text-xs text-secondary mt-1">{option.description}</p>}
                    </div>
                    <Switch
                        checked={currentValue as boolean}
                        onCheckedChange={checked => handleSettingUpdate(key, checked)}
                        ariaLabelledBy={labelId}
                    />
                </div>
            );
        }

        if (option.type === "string" || option.type === "number" || option.type === "select") {
            const maxVal = option.type === "number" && typeof option.max === "number" ? option.max : undefined;
            return (
                <div className="flex flex-col gap-2">
                    <div className="flex flex-col flex-1">
                        <label id={labelId} className="text-sm font-medium text-primary">{option.displayName || key}</label>
                        {option.description && <p className="text-xs text-secondary mt-1">{option.description}</p>}
                    </div>
                    <InputField
                        type={option.type === "string" ? "text" : option.type}
                        value={currentValue as string | number}
                        onChange={value => {
                            if (option.type === "number") {
                                let newValue = typeof value === "string" ? parseInt(value, 10) || 0 : value;
                                if (maxVal !== undefined && newValue > maxVal) {
                                    newValue = maxVal;
                                }
                                handleSettingUpdate(key, newValue);
                            } else {
                                handleSettingUpdate(key, value as string);
                            }
                        }}
                        options={option.options?.map(opt => ({ label: opt.label, value: opt.value as string })) ?? []}
                    />
                </div>
            );
        }

        return null;
    };

    return (
        <>
            <div
                className={clsx(
                    "relative flex flex-col p-4 bg-surface-l1 dark:bg-surface-l1",
                    "transition-colors duration-200 hover:bg-surface-l2",
                    cardWidth,
                    borderRadius,
                    "overflow-hidden"
                )}
                style={{
                    height: `${CARD_HEIGHT}px`, minHeight: `${CARD_HEIGHT}px`, maxHeight: `${CARD_HEIGHT}px`,
                    borderWidth: borderSize, borderStyle: "solid", borderColor: "var(--border-l1)"
                }}
            >
                <div className="absolute top-2 right-2 flex gap-2 items-center z-10">
                    <Button
                        icon={hasSettings ? "SlidersHorizontal" : "Info"}
                        size="icon"
                        variant="ghost"
                        iconSize={16}
                        onClick={() => setShowModal(true)}
                        aria-label={hasSettings ? "Show plugin settings" : "Show plugin information"}
                        className="text-secondary h-8 w-8"
                    />
                    <Switch
                        checked={plugin.required ? true : isEnabled}
                        disabled={plugin.required}
                        onCheckedChange={handleToggleChange}
                        ariaLabelledBy={switchLabelId}
                        aria-label={`Toggle ${plugin.name} (${plugin.required ? "required" : "optional"})`}
                    />
                </div>
                <div className="pr-20 flex flex-col h-full overflow-hidden">
                    <div id={switchLabelId} className="text-sm font-medium flex items-center gap-1.5 mb-3 truncate">
                        {plugin.name}
                    </div>
                    <div className="text-xs text-secondary leading-tight line-clamp-3">
                        {plugin.description}
                    </div>
                </div>
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={hasSettings ? `${plugin.name} Settings` : `${plugin.name} Info`}
                description={plugin.description}
                maxWidth="max-w-xl"
                className="h-[500px] max-h-[75vh]"
            >
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-medium text-primary mb-1">Authors</h3>
                        <p className="text-sm text-secondary">{plugin.authors.map(a => a.name).join(", ")}</p>
                    </div>
                    {plugin.requiresRestart && (
                        <div className="text-sm text-yellow-400 bg-yellow-400/10 p-3 rounded-lg border border-yellow-400/20">
                            This plugin requires a restart to take effect
                        </div>
                    )}
                    <div>
                        <h3 className="text-sm font-medium text-primary mb-1">Settings</h3>
                        {hasSettings ? (
                            <div className="mt-2 space-y-4">
                                {sortedOptions.map(([key, opt]) => (
                                    <div key={key}>
                                        {renderSettingControl(key, opt, settings[key])}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-secondary">No settings available for this plugin.</p>
                        )}
                    </div>
                </div>
            </Modal>
        </>
    );
};
