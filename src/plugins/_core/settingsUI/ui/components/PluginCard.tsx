/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Badge } from "@components/Badge";
import { IconButton } from "@components/IconButton";
import { LucideIcon } from "@components/LucideIcon";
import { Modal } from "@components/Modal";
import { Switch } from "@components/Switch";
import { usePluginSettings } from "@plugins/_core/settingsUI/ui/hooks/usePluginSettings";
import type { InferOptionType, IPlugin, PluginOptionBase, PluginOptions } from "@utils/types";
import clsx from "clsx";
import React, { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Props for the PluginCard component
 */
export interface PluginCardProps {
    /** The plugin object containing all plugin information */
    plugin: IPlugin;
    /** Border width in pixels */
    borderSize?: number;
    /** CSS width class for the card */
    cardWidth?: string;
    /** CSS border radius class for the card */
    borderRadius?: string;
    /** Callback function when plugin toggle state changes */
    onToggle?: (pluginName: string, isDisabled: boolean) => void;
    /** Callback function when plugin restart state changes */
    onRestartChange?: (pluginName: string, requiresRestart: boolean) => void;
}

export const PluginCard: React.FC<PluginCardProps> = ({
    plugin,
    borderSize = 1,
    cardWidth = "w-full",
    borderRadius = "rounded-xl",
    onToggle,
    onRestartChange,
}) => {
    const [showModal, setShowModal] = useState(false);
    const { settings, handleSettingChange } = usePluginSettings(
        plugin,
        onRestartChange
    );

    const pluginStorageKey = `plugin-disabled:${plugin.id}`;

    const [isEnabled, setIsEnabled] = useState(
        () => !localStorage.getItem(pluginStorageKey)
    );

    const hasSettings = Object.keys(plugin.options).length > 0;

    const handleToggle = useCallback(
        (checked: boolean) => {
            if (plugin.required) {
                return;
            }
            setIsEnabled(checked);
            if (checked) {
                localStorage.removeItem(pluginStorageKey);
                plugin.start?.({ storageKey: pluginStorageKey });
            } else {
                localStorage.setItem(pluginStorageKey, "1");
                plugin.stop?.({ storageKey: pluginStorageKey });
            }
            onToggle?.(plugin.name, !checked);
            if (onRestartChange) {
                onRestartChange(plugin.name, !!plugin.requiresRestart);
            }
        },
        [plugin, pluginStorageKey, onToggle, onRestartChange]
    );

    useEffect(() => {
        const handleStorageEvent = (e: StorageEvent) => {
            if (e.key === pluginStorageKey && !plugin.required) {
                setIsEnabled(!e.newValue);
            }
        };
        window.addEventListener("storage", handleStorageEvent);
        return () => window.removeEventListener("storage", handleStorageEvent);
    }, [pluginStorageKey, plugin.required]);

    useEffect(() => {
        if (plugin.required && !isEnabled) {
            setIsEnabled(true);
        }
    }, [plugin.required, isEnabled]);

    const switchLabelId = useMemo(() => `plugin-switch-${plugin.id}`, [plugin.id]);
    const modalAriaId = useMemo(
        () => `plugin-modal-title-${plugin.id}`,
        [plugin.id]
    );
    const modalUniqueKey = useMemo(
        () => `modal-${plugin.id}`,
        [plugin.id]
    );

    const SettingsIcon = (
        props: Omit<React.ComponentProps<typeof LucideIcon>, "name">
    ) => <LucideIcon name="Settings" {...props} />;
    const InfoIcon = (
        props: Omit<React.ComponentProps<typeof LucideIcon>, "name">
    ) => <LucideIcon name="Info" {...props} />;

    const handleSettingChangeWithRestart = useCallback(
        <K extends keyof PluginOptions>(key: K, value: InferOptionType<PluginOptions[K]>) => {
            handleSettingChange(key as string, value);
            if (onRestartChange && plugin.requiresRestart) {
                onRestartChange(plugin.name, true);
            }
        },
        [handleSettingChange, onRestartChange, plugin]
    );

    const renderSettingControl = (key: string, option: PluginOptionBase, currentValue: unknown) => {
        const labelId = `setting-label-${plugin.id}-${key}`;
        switch (option.type) {
            case "boolean":
                return (
                    <Switch
                        checked={currentValue as boolean}
                        onCheckedChange={(checked: boolean) => handleSettingChangeWithRestart(key, checked)}
                        ariaLabelledBy={labelId}
                    />
                );
            case "string":
                return (
                    <input
                        type="text"
                        value={currentValue as string}
                        onChange={e => handleSettingChangeWithRestart(key, e.target.value)}
                        className="w-full px-3 py-2 bg-surface-l2 border border-border-l1 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                );
            case "number":
                return (
                    <input
                        type="number"
                        value={currentValue as number}
                        onChange={e => handleSettingChangeWithRestart(key, parseFloat(e.target.value))}
                        className="w-full px-3 py-2 bg-surface-l2 border border-border-l1 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                );
            case "select":
                return (
                    <select
                        value={currentValue as string}
                        onChange={e => handleSettingChangeWithRestart(key, e.target.value)}
                        className="w-full px-3 py-2 bg-surface-l2 border border-border-l1 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        {option.options?.map(opt => (
                            <option key={opt.value as string} value={opt.value as string}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                );
            // Add cases for other types as needed
            default:
                return null;
        }
    };

    return (
        <>
            <div
                className={clsx(
                    "relative p-3 bg-surface-l1 dark:bg-surface-l1 flex flex-col transition-all duration-300 ease-in-out hover:shadow-md",
                    cardWidth,
                    "h-[90px]",
                    borderRadius
                )}
                style={{
                    borderWidth: borderSize,
                    borderStyle: "solid",
                    borderColor: "var(--border-l1)",
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) =>
                    (e.currentTarget.style.transform = "translateY(-2px)")
                }
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) =>
                    (e.currentTarget.style.transform = "translateY(0)")
                }
            >
                <div className="absolute top-2 right-2 flex gap-2 items-center">
                    <IconButton
                        icon={hasSettings ? SettingsIcon : InfoIcon}
                        size="sm"
                        variant="ghost"
                        iconSize={16}
                        onClick={() => setShowModal(true)}
                        aria-label={hasSettings ? "Show plugin settings" : "Show plugin information"}
                        className="text-secondary hover:text-primary"
                    />
                    <Switch
                        checked={plugin.required ? true : isEnabled}
                        disabled={plugin.required}
                        onCheckedChange={handleToggle}
                        ariaLabelledBy={switchLabelId}
                        aria-label={`Toggle ${plugin.name} (${plugin.required ? "required" : "optional"})`}
                    />
                </div>
                <div className="flex flex-col h-[52px] pr-20">
                    <p id={switchLabelId} className="text-sm font-medium mb-3">
                        {plugin.name}
                    </p>
                    <div className="text-xs text-secondary text-pretty leading-4 h-8 overflow-hidden line-clamp-2">
                        {plugin.description}
                    </div>
                </div>
            </div>

            {/* Unified Modal */}
            <Modal
                key={modalUniqueKey}
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={hasSettings ? `${plugin.name} Settings` : `${plugin.name} Info`}
                ariaLabelledBy={modalAriaId}
                maxWidth="max-w-2xl"
                className="max-h-[80vh]"
            >
                <div className="space-y-6">
                    <p className="text-sm text-secondary">
                        {plugin.description}
                    </p>

                    <div>
                        <h3 className="text-sm font-medium text-primary mb-1">
                            Authors
                        </h3>
                        <div className="flex flex-wrap gap-1">
                            {plugin.authors.map((author, index) => (
                                <Badge key={index}>{author.name}</Badge>
                            ))}
                        </div>
                    </div>

                    {plugin.requiresRestart && (
                        <div className="text-sm text-warning bg-warning/10 p-3 rounded-lg border border-warning/20">
                            This plugin requires a restart to take effect
                        </div>
                    )}

                    <div>
                        <h3 className="text-sm font-medium text-primary mb-1">
                            Settings
                        </h3>
                        {hasSettings ? (
                            <div className="mt-2 space-y-4">
                                {Object.entries(plugin.options).map(([key, option]) => {
                                    const currentValue = settings[key];
                                    const labelId = `setting-label-${plugin.id}-${key}`;

                                    return (
                                        <div
                                            key={key}
                                            className="flex justify-between items-start gap-4"
                                        >
                                            <div className="flex flex-col flex-1">
                                                <label
                                                    id={labelId}
                                                    className="text-sm font-medium text-primary"
                                                >
                                                    {option.displayName || key}
                                                </label>
                                                {option.description && (
                                                    <p className="text-xs text-secondary mt-1">
                                                        {option.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex-shrink-0 mt-1">
                                                {renderSettingControl(key, option, currentValue)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-secondary">
                                No settings available for this plugin.
                            </p>
                        )}
                    </div>
                </div>
            </Modal>
        </>
    );
};
