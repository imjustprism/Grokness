/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ErrorBoundary } from "@components/ErrorBoundary";
import { Grid } from "@components/Grid";
import { Subheader } from "@components/Subheader";
import { DropdownMenu, type DropdownOption } from "@plugins/_core/settingsUI/components/DropdownMenu";
import { FilterBar } from "@plugins/_core/settingsUI/components/FilterBar";
import { NotificationBanner } from "@plugins/_core/settingsUI/components/NotificationBanner";
import { PluginCard } from "@plugins/_core/settingsUI/components/PluginCard";
import { SearchInput } from "@plugins/_core/settingsUI/components/SearchInput";
import { type IPlugin } from "@utils/types";
import React, { useEffect, useMemo, useRef } from "react";

/**
 * Available filter options for plugin display
 */
type FilterOption = "show_all" | "show_enabled" | "show_disabled";

/**
 * Props for the SettingsPanel component
 */
interface SettingsPanelProps {
    /** Controls whether the settings panel is visible */
    isActive: boolean;
    /** Current search text for filtering plugins */
    filterText: string;
    /** Callback to update the search text */
    setFilterText: (text: string) => void;
    /** Current filter option for plugin display */
    filterOption: FilterOption;
    /** Callback to update the filter option */
    setFilterOption: (option: FilterOption) => void;
    /** Record of plugins with pending changes requiring restart */
    pendingChanges: Record<string, boolean>;
    /** Array of plugin sections with their items */
    sections: { title: string; items: IPlugin[]; }[];
    /** Callback for toggling plugin enable/disable state */
    handlePluginToggle: (pluginName: string, isDisabled: boolean) => void;
    /** Callback for handling restart changes */
    handleRestartChange: (
        pluginName: string,
        requiresRestart: boolean,
        source: "toggle" | "settings"
    ) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    isActive,
    filterText,
    setFilterText,
    filterOption,
    setFilterOption,
    pendingChanges,
    sections,
    handlePluginToggle,
    handleRestartChange,
}) => {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isActive) {
            return;
        }

        const element = panelRef.current;
        if (!element) {
            return;
        }

        const parentScroller = element.parentElement;

        if (parentScroller && (parentScroller.classList.contains("overflow-scroll") || parentScroller.classList.contains("overflow-y-auto"))) {
            const originalOverflow = parentScroller.style.overflow;
            const originalPaddingRight = parentScroller.style.paddingRight;
            const originalPaddingLeft = parentScroller.style.paddingLeft;

            parentScroller.style.overflow = "hidden";
            parentScroller.style.paddingRight = "0px";
            parentScroller.style.paddingLeft = "0px";

            return () => {
                parentScroller.style.overflow = originalOverflow;
                parentScroller.style.paddingRight = originalPaddingRight;
                parentScroller.style.paddingLeft = originalPaddingLeft;
            };
        }
    }, [isActive]);

    const filterOptions: DropdownOption<FilterOption>[] = useMemo(() => [
        { label: "Show All", value: "show_all" },
        { label: "Show Enabled", value: "show_enabled" },
        { label: "Show Disabled", value: "show_disabled" },
    ], []);

    return (
        <div
            ref={panelRef}
            data-grokness-panel
            className="flex-1 w-full h-full pl-4 pb-32 overflow-y-auto focus:outline-none"
            style={{ display: isActive ? "flex" : "none" }}
        >
            {isActive && (
                <div className="flex flex-col w-full gap-4 min-h-full pr-4">
                    {Object.keys(pendingChanges).length > 0 && (
                        <NotificationBanner
                            title="Restart Required!"
                            description="Restart to apply new plugins and settings"
                            actionText="Restart"
                            onAction={() => location.reload()}
                        />
                    )}
                    {sections.map(({ title, items }) => (
                        <div key={title} className="w-full mb-4">
                            {title === "Required Plugins" && (
                                <div className="mb-6">
                                    <div
                                        data-orientation="horizontal"
                                        role="none"
                                        className="shrink-0 bg-border h-[1px] w-full"
                                    ></div>
                                </div>
                            )}
                            <Subheader>{title}</Subheader>
                            {title === "Filters" ? (
                                <FilterBar>
                                    <div className="flex-1">
                                        <SearchInput
                                            value={filterText}
                                            onChange={setFilterText}
                                            placeholder="Search for a plugin..."
                                        />
                                    </div>
                                    <div className="ml-auto">
                                        <DropdownMenu<FilterOption>
                                            options={filterOptions}
                                            value={filterOption}
                                            onChange={setFilterOption}
                                            className="w-48"
                                            width="w-48"
                                        />
                                    </div>
                                </FilterBar>
                            ) : (
                                <Grid cols={2} gap="md">
                                    {items.map(plugin => (
                                        <ErrorBoundary key={plugin.id} pluginId={plugin.id}>
                                            <PluginCard
                                                plugin={plugin}
                                                onToggle={handlePluginToggle}
                                                onRestartChange={handleRestartChange}
                                            />
                                        </ErrorBoundary>
                                    ))}
                                </Grid>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
