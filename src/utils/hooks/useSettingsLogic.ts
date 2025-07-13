/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type IPlugin, plugins as allPlugins } from "@utils/types";
import { useCallback, useMemo, useState } from "react";

type FilterOptionType = "show_all" | "show_enabled" | "show_disabled";

export const useSettingsLogic = () => {
    const [filterSearchText, setFilterSearchText] = useState("");
    const [filterDisplayOption, setFilterDisplayOption] = useState<FilterOptionType>("show_all");
    const [pendingRestartChanges, setPendingRestartChanges] = useState<
        Record<string, boolean>
    >({});
    const [disabledPluginsState, setDisabledPluginsState] = useState<
        Record<string, boolean>
    >(() => {
        const disabledState: Record<string, boolean> = {};
        allPlugins.forEach(plugin => {
            disabledState[plugin.id] = Boolean(
                localStorage.getItem(`plugin-disabled:${plugin.id}`)
            );
        });
        return disabledState;
    });

    const handleRestartUpdate = useCallback(
        (name: string, requires: boolean) => {
            setPendingRestartChanges(prev => {
                const updated = { ...prev };
                if (requires) {
                    updated[name] = true;
                } else {
                    delete updated[name];
                }
                return updated;
            });
        },
        []
    );

    const handlePluginToggleUpdate = useCallback(
        (pluginName: string, isDisabled: boolean) => {
            setDisabledPluginsState(prev => ({
                ...prev,
                [pluginName]: isDisabled,
            }));
        },
        []
    );

    const handleFilterOptionUpdate = useCallback((option: FilterOptionType) => {
        setFilterDisplayOption(option);
    }, []);

    const visiblePluginsList = useMemo(
        () => allPlugins.filter(p => p.visible !== false),
        []
    );

    const filteredPlugins = useMemo(() => {
        const lowerSearch = filterSearchText.toLowerCase();
        const searchFiltered = visiblePluginsList.filter(p =>
            p.name.toLowerCase().includes(lowerSearch) || p.description.toLowerCase().includes(lowerSearch)
        );

        if (filterDisplayOption === "show_all") {
            return searchFiltered;
        }

        return searchFiltered.filter(p => {
            const isDisabled = disabledPluginsState[p.id];
            return filterDisplayOption === "show_enabled" ? !isDisabled : isDisabled;
        });
    }, [filterSearchText, visiblePluginsList, filterDisplayOption, disabledPluginsState]);

    const sections = useMemo(() => {
        const nonRequiredPlugins = filteredPlugins.filter(p => !p.required).sort((a, b) => a.name.localeCompare(b.name));
        const requiredPlugins = filteredPlugins.filter(p => p.required).sort((a, b) => a.name.localeCompare(b.name));

        return [
            { title: "Filters", items: [] as IPlugin[] },
            { title: "Plugins", items: nonRequiredPlugins },
            { title: "Required Plugins", items: requiredPlugins },
        ].filter(section => section.title === "Filters" || section.items.length > 0);
    }, [filteredPlugins]);

    return {
        filterText: filterSearchText,
        setFilterText: setFilterSearchText,
        filterOption: filterDisplayOption,
        setFilterOption: handleFilterOptionUpdate,
        pendingChanges: pendingRestartChanges,
        sections,
        handleRestartChange: handleRestartUpdate,
        handlePluginToggle: handlePluginToggleUpdate,
    };
};
