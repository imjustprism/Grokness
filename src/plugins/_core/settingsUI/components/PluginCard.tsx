/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IconButton } from "@components/IconButton";
import { InputField } from "@components/InputField";
import { LucideIcon } from "@components/LucideIcon";
import { Modal } from "@components/Modal";
import { Switch } from "@components/Switch";
import { usePluginSettings } from "@hooks/usePluginSettings";
import type { InferOptionType, IPlugin, PluginOptionBase, PluginOptions } from "@utils/types";
import clsx from "clsx";
import React, { useCallback, useEffect, useMemo, useState } from "react";

const CARD_HEIGHT = 120; // Configurable fixed height in pixels
const CARD_BORDER_WIDTH = 1; // Default border width

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

/**
 * Renders the plugin title with consistent styling
 */
const PluginTitle: React.FC<{ id: string; title: string; }> = ({ id, title }) => (
    <div id={id} className="text-sm font-medium flex flex-row items-center gap-1.5 mb-3 truncate">
        {title}
    </div>
);

/**
 * Renders the plugin description with consistent styling and truncation
 */
const PluginDescription: React.FC<{ description: string; }> = ({ description }) => (
    <div className="text-xs text-secondary text-pretty leading-tight line-clamp-3 overflow-hidden">
        {description}
    </div>
);

/**
 * Renders the action buttons (settings/info and toggle switch)
 */
const PluginActions: React.FC<{
    hasSettings: boolean;
    onSettingsClick: () => void;
    isEnabled: boolean;
    isRequired: boolean;
    onToggle: (checked: boolean) => void;
    switchLabelId: string;
    pluginName: string;
}> = ({ hasSettings, onSettingsClick, isEnabled, isRequired, onToggle, switchLabelId, pluginName }) => {
    const SettingsIcon = (props: Omit<React.ComponentProps<typeof LucideIcon>, "name">) => (
        <LucideIcon name="SlidersHorizontal" {...props} />
    );
    const InfoIcon = (props: Omit<React.ComponentProps<typeof LucideIcon>, "name">) => (
        <LucideIcon name="Info" {...props} />
    );

    return (
        <div className="absolute top-2 right-2 flex gap-2 items-center z-10">
            <IconButton
                icon={hasSettings ? SettingsIcon : InfoIcon}
                size="sm"
                variant="ghost"
                iconSize={16}
                onClick={onSettingsClick}
                aria-label={hasSettings ? "Show plugin settings" : "Show plugin information"}
                className="text-secondary hover:text-primary"
            />
            <Switch
                checked={isRequired ? true : isEnabled}
                disabled={isRequired}
                onCheckedChange={onToggle}
                ariaLabelledBy={switchLabelId}
                aria-label={`Toggle ${pluginName} (${isRequired ? "required" : "optional"})`}
            />
        </div>
    );
};

/**
 * Renders the settings modal content
 */
const SettingsModalContent: React.FC<{
    plugin: IPlugin;
    hasSettings: boolean;
    settings: Record<string, unknown>;
    renderControl: (key: string, option: PluginOptionBase, value: unknown) => React.ReactNode;
}> = ({ plugin, hasSettings, settings, renderControl }) => (
    <div className="p-4 space-y-4">
        <p className="text-sm text-secondary">{plugin.description}</p>
        <div>
            <h3 className="text-sm font-medium text-primary mb-1">Authors</h3>
            <p className="text-sm text-secondary">{plugin.authors.map(author => author.name).join(", ")}</p>
        </div>
        {plugin.requiresRestart && (
            <div className="text-sm text-warning bg-warning/10 p-3 rounded-lg border border-warning/20">
                This plugin requires a restart to take effect
            </div>
        )}
        <div>
            <h3 className="text-sm font-medium text-primary mb-1">Settings</h3>
            {hasSettings ? (
                <div className="mt-2 space-y-4">
                    {Object.entries(plugin.options).map(([key, option]) => {
                        const currentValue = settings[key];
                        const labelId = `setting-label-${plugin.id}-${key}`;
                        return (
                            <div key={key} className="flex justify-between items-start gap-4">
                                <div className="flex flex-col flex-1">
                                    <label id={labelId} className="text-sm font-medium text-primary">
                                        {option.displayName || key}
                                    </label>
                                    {option.description && <p className="text-xs text-secondary mt-1">{option.description}</p>}
                                </div>
                                <div className="flex-shrink-0 mt-1">{renderControl(key, option, currentValue)}</div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-sm text-secondary">No settings available for this plugin.</p>
            )}
        </div>
    </div>
);

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

    const pluginStorageKey = `plugin-disabled:${plugin.id}`;

    const [isEnabled, setIsEnabled] = useState(() => !localStorage.getItem(pluginStorageKey));

    const hasSettings = Object.keys(plugin.options).length > 0;

    const handleToggleChange = useCallback((checked: boolean) => {
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
        if (onRestartChange && plugin.requiresRestart) {
            onRestartChange(plugin.name, true);
        }
    }, [plugin, pluginStorageKey, onToggle, onRestartChange]);

    useEffect(() => {
        const storageListener = (e: StorageEvent) => {
            if (e.key === pluginStorageKey && !plugin.required) {
                setIsEnabled(!e.newValue);
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
    const modalAriaId = useMemo(() => `plugin-modal-title-${plugin.id}`, [plugin.id]);

    const handleSettingUpdate = useCallback(<K extends keyof PluginOptions>(
        key: K,
        value: InferOptionType<PluginOptions[K]>
    ) => {
        handleSettingChange(key as string, value);
        if (onRestartChange && plugin.requiresRestart) {
            onRestartChange(plugin.name, true);
        }
    }, [handleSettingChange, onRestartChange, plugin]);

    const renderControl = (key: string, option: PluginOptionBase, currentValue: unknown) => {
        const labelId = `setting-label-${plugin.id}-${key}`;
        switch (option.type) {
            case "boolean":
                return <Switch checked={currentValue as boolean} onCheckedChange={checked => handleSettingUpdate(key, checked)} ariaLabelledBy={labelId} />;
            case "string":
                return <InputField type="text" value={currentValue as string} onChange={value => handleSettingUpdate(key, value as string)} />;
            case "number":
                const minVal = typeof option.min === "number" ? option.min : undefined;
                const maxVal = typeof option.max === "number" ? option.max : undefined;
                return (
                    <InputField
                        type="number"
                        value={currentValue as number}
                        onChange={value => {
                            let newValue = typeof value === "string" ? parseFloat(value) || 0 : value;
                            if (minVal !== undefined && newValue < minVal) {
                                newValue = minVal;
                            }
                            if (maxVal !== undefined && newValue > maxVal) {
                                newValue = maxVal;
                            }
                            handleSettingUpdate(key, newValue);
                        }}
                        min={minVal}
                    />
                );
            case "select":
                return (
                    <InputField
                        type="select"
                        value={currentValue as string}
                        onChange={value => handleSettingUpdate(key, value as string)}
                        options={option.options?.map(opt => ({ label: opt.label, value: opt.value as string })) ?? []}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <>
            <div
                className={clsx(
                    "relative flex flex-col p-4 bg-surface-l1 dark:bg-surface-l1",
                    "transition-all duration-300 ease-in-out hover:shadow-md",
                    cardWidth,
                    borderRadius,
                    "overflow-hidden"
                )}
                style={{
                    height: `${CARD_HEIGHT}px`,
                    minHeight: `${CARD_HEIGHT}px`,
                    maxHeight: `${CARD_HEIGHT}px`,
                    borderWidth: borderSize,
                    borderStyle: "solid",
                    borderColor: "var(--border-l1)",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >
                <PluginActions
                    hasSettings={hasSettings}
                    onSettingsClick={() => setShowModal(true)}
                    isEnabled={isEnabled}
                    isRequired={plugin.required}
                    onToggle={handleToggleChange}
                    switchLabelId={switchLabelId}
                    pluginName={plugin.name}
                />
                <div className="pr-20 flex flex-col h-full overflow-hidden">
                    <PluginTitle id={switchLabelId} title={plugin.name} />
                    <PluginDescription description={plugin.description} />
                </div>
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={hasSettings ? `${plugin.name} Settings` : `${plugin.name} Info`}
                ariaLabelledBy={modalAriaId}
                maxWidth="max-w-2xl"
                className="max-h-[80vh] overflow-y-auto"
            >
                <SettingsModalContent
                    plugin={plugin}
                    hasSettings={hasSettings}
                    settings={settings}
                    renderControl={renderControl}
                />
            </Modal>
        </>
    );
};
