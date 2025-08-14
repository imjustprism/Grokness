/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { DropdownMenu, type DropdownOption } from "@components/DropdownMenu";
import { ErrorBoundary } from "@components/ErrorBoundary";
import { Grid } from "@components/Grid";
import { InputField } from "@components/InputField";
import { Modal } from "@components/Modal";
import { Panel } from "@components/Panel";
import { Separator } from "@components/Separator";
import { Slider } from "@components/Slider";
import { Subheader } from "@components/Subheader";
import { Switch } from "@components/Switch";
import { Tab } from "@components/Tab";
import { usePluginSettings } from "@plugins/_core/settingsUI/hooks/usePluginSettings";
import { useSettingsLogic } from "@plugins/_core/settingsUI/hooks/useSettingsLogic";
import styles from "@plugins/_core/settingsUI/styles.css?raw";
import { Devs } from "@utils/constants";
import { selectOne } from "@utils/dom";
import { LOCATORS } from "@utils/locators";
import { Logger } from "@utils/logger";
import type { InferOptionType, IPlugin, PluginOptionBase, PluginOptions } from "@utils/types";
import definePlugin, { Patch } from "@utils/types";
import clsx from "clsx";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const pluginCardLogger = new Logger("PluginCard", "#f5c2e7");

interface PluginCardProps {
    plugin: IPlugin;
    onToggle: (pluginName: string, isDisabled: boolean) => void;
    onRestartChange: (
        pluginName: string,
        requiresRestart: boolean,
        source: "toggle" | "settings"
    ) => void;
}

const CARD_HEIGHT = 120;

const PluginCard: React.FC<PluginCardProps> = ({
    plugin,
    onToggle,
    onRestartChange,
}) => {
    const [showModal, setShowModal] = useState(false);
    const { settings, handleSettingChange } = usePluginSettings(
        plugin,
        onRestartChange
    );
    const debounceTimer = useRef<number | null>(null);

    const pluginStorageKey = `plugin-enabled:${plugin.id}`;
    const initialEnabled = useMemo(
        () => !!localStorage.getItem(pluginStorageKey),
        [pluginStorageKey]
    );
    const [isEnabled, setIsEnabled] = useState(initialEnabled);

    const hasSettings = Object.keys(plugin.options).length > 0;

    const sortedOptions = useMemo(() => {
        const typeOrder: Record<string, number> = {
            select: 0,
            string: 1,
            number: 2,
            slider: 3,
            custom: 4,
            boolean: 5,
        };
        return Object.entries(plugin.options).sort(([, a], [, b]) => {
            const orderA = typeOrder[a.type] ?? 99;
            const orderB = typeOrder[b.type] ?? 99;
            return orderA - orderB;
        });
    }, [plugin.options]);

    const handleToggleChange = useCallback(
        (checked: boolean) => {
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
                        plugin.start?.({ storageKey: pluginStorageKey });
                    } else {
                        localStorage.removeItem(pluginStorageKey);
                        plugin.stop?.({ storageKey: pluginStorageKey });
                    }
                } catch (error) {
                    pluginCardLogger.error(
                        `Error toggling plugin "${plugin.name}":`,
                        error
                    );
                }

                if (onRestartChange && plugin.requiresRestart) {
                    const requiresRestart = checked !== initialEnabled;
                    onRestartChange(plugin.name, requiresRestart, "toggle");
                }
            }, 250);
        },
        [
            plugin,
            pluginStorageKey,
            onToggle,
            onRestartChange,
            initialEnabled,
        ]
    );

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

    const switchLabelId = useMemo(
        () => `plugin-switch-${plugin.id}`,
        [plugin.id]
    );

    const handleSettingUpdate = useCallback(
        <K extends keyof PluginOptions>(
            key: K,
            value: InferOptionType<PluginOptions[K]>
        ) => {
            handleSettingChange(key as string, value);
        },
        [handleSettingChange]
    );

    type SliderOption = PluginOptionBase & {
        type: "slider";
        min?: number;
        max?: number;
        step?: number;
        suffix?: string;
    };
    const isSliderOption = (opt: PluginOptionBase): opt is SliderOption =>
        opt.type === "slider";

    const renderSettingControl = (
        key: string,
        option: PluginOptionBase,
        currentValue: unknown
    ) => {
        const labelId = `setting-label-${plugin.id}-${key}`;

        if (option.type === "boolean") {
            return (
                <div className="flex justify-between items-center">
                    <div className="flex flex-col flex-1 pr-4">
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
                    <Switch
                        checked={currentValue as boolean}
                        onCheckedChange={checked =>
                            handleSettingUpdate(key, checked)
                        }
                        aria-labelledby={labelId}
                    />
                </div>
            );
        }

        if (
            option.type === "string" ||
            option.type === "number" ||
            option.type === "select" ||
            option.type === "slider"
        ) {
            const maxVal =
                option.type === "number" &&
                    typeof (option as { max?: number; }).max === "number"
                    ? (option as { max?: number; }).max
                    : undefined;
            return (
                <div className="flex flex-col gap-2">
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
                    {isSliderOption(option) ? (
                        <div className="flex items-center gap-3">
                            <Slider
                                value={[(currentValue as number) ?? 0]}
                                min={
                                    typeof option.min === "number"
                                        ? option.min
                                        : 0
                                }
                                max={
                                    typeof option.max === "number"
                                        ? option.max
                                        : 100
                                }
                                step={
                                    typeof option.step === "number"
                                        ? option.step
                                        : 1
                                }
                                onValueChange={([val]) =>
                                    handleSettingUpdate(key, val)
                                }
                                aria-labelledby={labelId}
                            />
                            <div className="text-xs text-secondary min-w-[3rem] text-right">
                                {currentValue as number}
                                {option.suffix}
                            </div>
                        </div>
                    ) : (
                        (() => {
                            const inputType: "text" | "number" | "select" =
                                option.type === "string"
                                    ? "text"
                                    : (option.type as "number" | "select");
                            return (
                                <InputField
                                    type={inputType}
                                    value={currentValue as string | number}
                                    onChange={value => {
                                        if (option.type === "number") {
                                            let newValue =
                                                typeof value === "string"
                                                    ? parseInt(value, 10) || 0
                                                    : value;
                                            if (
                                                maxVal !== undefined &&
                                                newValue > maxVal
                                            ) {
                                                newValue = maxVal;
                                            }
                                            handleSettingUpdate(key, newValue);
                                        } else {
                                            handleSettingUpdate(
                                                key,
                                                value as string
                                            );
                                        }
                                    }}
                                    options={
                                        option.options?.map(opt => ({
                                            label: opt.label,
                                            value: opt.value as string,
                                        })) ?? []
                                    }
                                />
                            );
                        })()
                    )}
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
                    "w-full rounded-xl overflow-hidden"
                )}
                style={{
                    height: `${CARD_HEIGHT}px`,
                    minHeight: `${CARD_HEIGHT}px`,
                    maxHeight: `${CARD_HEIGHT}px`,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: "var(--border-l1)",
                }}
            >
                <div className="absolute top-2 right-2 flex gap-2 items-center z-10">
                    <Button
                        icon={hasSettings ? "SlidersHorizontal" : "Info"}
                        size="icon"
                        variant="ghost"
                        iconSize={16}
                        onClick={() => setShowModal(true)}
                        aria-label={
                            hasSettings
                                ? "Show plugin settings"
                                : "Show plugin information"
                        }
                        className="text-secondary h-8 w-8"
                    />
                    <Switch
                        checked={plugin.required ? true : isEnabled}
                        disabled={plugin.required}
                        onCheckedChange={handleToggleChange}
                        aria-labelledby={switchLabelId}
                        aria-label={`Toggle ${plugin.name} (${plugin.required ? "required" : "optional"
                            })`}
                    />
                </div>
                <div className="pr-20 flex flex-col h-full overflow-hidden">
                    <div
                        id={switchLabelId}
                        className="text-sm font-medium flex items-center gap-1.5 mb-3 truncate"
                    >
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
                title={plugin.name}
                description={plugin.description}
                maxWidth="max-w-xl"
                className="h-[500px] max-h-[75vh]"
            >
                <div className="flex flex-col gap-4 w-full pr-6">
                    <div className="w-full">
                        <p className="text-sm text-secondary">
                            <span className="font-medium text-primary">Authors: </span>
                            {plugin.authors.map(a => a.name).join(", ")}
                        </p>
                    </div>
                    {plugin.requiresRestart && (
                        <div className="text-sm text-yellow-400 bg-yellow-400/10 p-3 rounded-lg border border-yellow-400/20">
                            This plugin requires a restart to take effect
                        </div>
                    )}
                    <div>
                        <h3 className="text-sm font-medium text-primary mb-1">Settings</h3>
                        {hasSettings ? (
                            <div className="mt-2 space-y-4 w-full">
                                {sortedOptions.map(([key, opt]) => (
                                    <div key={key}>
                                        {renderSettingControl(
                                            key,
                                            opt,
                                            settings[key]
                                        )}
                                    </div>
                                ))}
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

const SettingsUIComponent: React.FC<{ rootElement?: HTMLElement; }> = ({
    rootElement,
}) => {
    const [active, setActive] = useState(false);
    const logic = useSettingsLogic();

    if (!rootElement) {
        return null;
    }

    const dialogRoot =
        selectOne(LOCATORS.SETTINGS_MODAL.dialog, rootElement) ?? rootElement;
    const contentArea = selectOne(
        LOCATORS.SETTINGS_MODAL.contentArea,
        dialogRoot
    );
    const sidebarArea = selectOne(
        LOCATORS.SETTINGS_MODAL.leftNavContainer,
        dialogRoot
    );

    useEffect(() => {
        if (!sidebarArea) {
            return;
        }
        const onClick = (e: MouseEvent) => {
            const btn = (e.target as HTMLElement).closest("button");
            if (!btn || !sidebarArea.contains(btn)) {
                return;
            }
            const isGrokness = btn.hasAttribute("data-grokness-tab");
            setActive(isGrokness);
            sidebarArea.querySelectorAll("button").forEach(b => {
                const activeBtn = b === btn;
                b.setAttribute("aria-selected", String(activeBtn));
                if (b.hasAttribute("data-grokness-tab")) {
                    return;
                }
                if (activeBtn) {
                    b.classList.add("text-primary", "bg-button-ghost-hover");
                    b.classList.remove("text-fg-primary");
                } else {
                    b.classList.remove(
                        "text-primary",
                        "bg-button-ghost-hover",
                        "[&>svg]:text-primary"
                    );
                    b.classList.add("text-fg-primary");
                }
                const svg = b.querySelector("svg");
                if (svg) {
                    svg.classList.toggle("text-primary", activeBtn);
                    svg.classList.toggle("text-secondary", !activeBtn);
                }
            });
        };
        sidebarArea.addEventListener("click", onClick as EventListener);
        return () =>
            sidebarArea.removeEventListener("click", onClick as EventListener);
    }, [sidebarArea]);

    useEffect(() => {
        if (!contentArea) {
            return;
        }
        Array.from(contentArea.children).forEach(n => {
            const el = n as HTMLElement;
            if (el.hasAttribute("data-grokness-panel")) {
                el.style.display = active ? "flex" : "none";
            } else {
                el.style.display = active ? "none" : "flex";
            }
        });
    }, [active, contentArea]);

    useEffect(() => {
        if (!contentArea) {
            return;
        }
        const area = contentArea as HTMLElement;
        if (active) {
            if (area.dataset.groknessPrevPaddingRight == null) {
                area.dataset.groknessPrevPaddingRight =
                    area.style.paddingRight || "";
            }
            if (area.dataset.groknessPrevOverflowY == null) {
                area.dataset.groknessPrevOverflowY = area.style.overflowY || "";
            }
            area.style.paddingRight = "0px";
            area.style.overflowY = "hidden";
        } else {
            const prevPR = area.dataset.groknessPrevPaddingRight ?? "";
            const prevOY = area.dataset.groknessPrevOverflowY ?? "";
            area.style.paddingRight = prevPR;
            area.style.overflowY = prevOY;
            delete area.dataset.groknessPrevPaddingRight;
            delete area.dataset.groknessPrevOverflowY;
        }
        return () => {
            const prevPR = area.dataset.groknessPrevPaddingRight ?? "";
            const prevOY = area.dataset.groknessPrevOverflowY ?? "";
            area.style.paddingRight = prevPR;
            area.style.overflowY = prevOY;
            delete area.dataset.groknessPrevPaddingRight;
            delete area.dataset.groknessPrevOverflowY;
        };
    }, [active, contentArea]);

    if (!contentArea || !sidebarArea) {
        return null;
    }

    const filterOptions: DropdownOption<
        "show_all" | "show_enabled" | "show_disabled"
    >[] = useMemo(
        () => [
            { label: "Show All", value: "show_all" },
            { label: "Show Enabled", value: "show_enabled" },
            { label: "Show Disabled", value: "show_disabled" },
        ],
        []
    );

    const tabMountRef = React.useRef<HTMLElement | null>(null);

    const hasActiveFilter = logic.filterText.trim().length > 0;
    const filterSection = logic.sections.find(s => s.title === "Filters");
    const requiredSection = logic.sections.find(
        s => s.title === "Required Plugins"
    );
    const pluginSections = logic.sections.filter(
        s => s.title !== "Filters" && s.title !== "Required Plugins"
    );

    const getTabMountContainer = (): HTMLElement | null => {
        if (!sidebarArea) {
            return null;
        }
        let mount = sidebarArea.querySelector<HTMLElement>(
            "[data-grokness-settings-tab]"
        );
        if (!mount) {
            mount = document.createElement("div");
            mount.setAttribute("data-grokness-settings-tab", "true");
            const devToolsBtn = selectOne(
                LOCATORS.SETTINGS_MODAL.navButtonByText("Dev Tools"),
                dialogRoot
            );
            if (devToolsBtn && devToolsBtn.parentElement === sidebarArea) {
                sidebarArea.insertBefore(mount, devToolsBtn.nextSibling);
            } else if (devToolsBtn) {
                devToolsBtn.insertAdjacentElement("afterend", mount);
            } else {
                sidebarArea.appendChild(mount);
            }
        }
        tabMountRef.current = mount;
        return mount;
    };

    useEffect(
        () => () => {
            const mount = tabMountRef.current;
            if (mount && mount.parentElement) {
                mount.remove();
                tabMountRef.current = null;
            }
        },
        []
    );

    const PanelBody = (
        <Panel
            isActive={active}
            data-grokness-panel
            className="flex-1 w-full h-full pl-4 pb-32"
        >
            <div className="flex flex-col w-full gap-4 min-h-full pr-4">
                {Object.keys(logic.pendingChanges).length > 0 && (
                    <div className="w-full mb-6">
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r rounded-lg shadow-lg border from-yellow-800/50 to-yellow-700/50 border-yellow-600">
                            <div className="flex flex-col gap-1">
                                <div className="text-white text-sm font-medium">
                                    Restart Required!
                                </div>
                                <div className="text-xs text-gray-400">
                                    Restart to apply new plugins and settings
                                </div>
                            </div>
                            <Button
                                onClick={() => location.reload()}
                                variant="outline"
                                color="warning"
                            >
                                Restart
                            </Button>
                        </div>
                    </div>
                )}
                {filterSection && (
                    <div key={filterSection.title} className="w-full mb-4">
                        <Subheader>{filterSection.title}</Subheader>
                        <div
                            className={clsx(
                                "flex items-center justify-start w-full gap-4",
                                "rounded-lg py-2"
                            )}
                        >
                            <div className="flex-1">
                                <InputField
                                    type="search"
                                    value={logic.filterText}
                                    onChange={v =>
                                        logic.setFilterText(String(v))
                                    }
                                    placeholder="Search for a plugin..."
                                    variant="search"
                                />
                            </div>
                            <div className="ml-auto">
                                <DropdownMenu
                                    options={filterOptions}
                                    value={logic.filterOption}
                                    onChange={logic.setFilterOption}
                                    className="w-48"
                                    width="w-48"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Plugin Sections */}
                {pluginSections.map(({ title, items }) => (
                    <div key={title} className="w-full mb-4">
                        <Subheader>{title}</Subheader>
                        {items.length > 0 ? (
                            <Grid cols={2} gap="md">
                                {items.map(plugin => (
                                    <ErrorBoundary
                                        key={plugin.id}
                                        pluginId={plugin.id}
                                    >
                                        <PluginCard
                                            plugin={plugin}
                                            onToggle={logic.handlePluginToggle}
                                            onRestartChange={
                                                logic.handleRestartChange
                                            }
                                        />
                                    </ErrorBoundary>
                                ))}
                            </Grid>
                        ) : hasActiveFilter ? (
                            <div className="text-sm text-secondary py-2">
                                No plugins meet the search criteria.
                            </div>
                        ) : null}
                    </div>
                ))}

                {/* Required Plugins Section */}
                <div className="w-full mb-4">
                    <div className="mb-6">
                        <Separator />
                    </div>
                    <Subheader>Required Plugins</Subheader>
                    {requiredSection && requiredSection.items.length > 0 ? (
                        <Grid cols={2} gap="md">
                            {requiredSection.items.map(plugin => (
                                <ErrorBoundary
                                    key={plugin.id}
                                    pluginId={plugin.id}
                                >
                                    <PluginCard
                                        plugin={plugin}
                                        onToggle={logic.handlePluginToggle}
                                        onRestartChange={
                                            logic.handleRestartChange
                                        }
                                    />
                                </ErrorBoundary>
                            ))}
                        </Grid>
                    ) : hasActiveFilter ? (
                        <div className="text-sm text-secondary py-2">
                            No plugins meet the search criteria.
                        </div>
                    ) : null}
                </div>
            </div>
        </Panel>
    );

    return (
        <>
            {(() => {
                const target = getTabMountContainer();
                return target
                    ? createPortal(
                        <Tab
                            isActive={active}
                            onClick={() => setActive(true)}
                            icon="TestTubeDiagonal"
                            variant="ghost"
                            color="default"
                            size="md"
                            className="min-w-40 justify-start gap-3 border-none hover:bg-card-hover"
                            dataAttr="true"
                        >
                            Grokness
                        </Tab>,
                        target
                    )
                    : null;
            })()}
            {createPortal(PanelBody, contentArea)}
        </>
    );
};

export default definePlugin({
    name: "Settings",
    description: "Adds a settings panel to manage Grokness plugins.",
    authors: [Devs.Prism],
    required: true,
    hidden: true,
    category: "utility",
    tags: ["settings", "ui", "core"],
    styles,
    patches: [
        Patch.ui('div[role="dialog"][data-state="open"]')
            .forEach()
            .component(SettingsUIComponent)
            .parent(el => el)
            .build(),
    ],
});
