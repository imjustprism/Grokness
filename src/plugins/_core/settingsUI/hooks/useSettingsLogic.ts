/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type IPlugin, plugins as allPlugins } from "@utils/types";
import { useCallback, useMemo, useState } from "react";

type FilterOptionType = "show_all" | "show_enabled" | "show_disabled";
type RestartSourceType = "toggle" | "settings";

export const useSettingsLogic = () => {
    const [filterSearchText, setFilterSearchText] = useState("");
    const [filterDisplayOption, setFilterDisplayOption] = useState<FilterOptionType>("show_all");
    const [restartSourcesMap, setRestartSourcesMap] = useState<Record<string, Set<RestartSourceType>>>({});
    const [disabledPluginsMap, setDisabledPluginsMap] = useState<Record<string, boolean>>(() => {
        const initialDisabledMap: Record<string, boolean> = {};
        allPlugins.forEach(pluginItem => {
            initialDisabledMap[pluginItem.id] = pluginItem.required ? false : !Boolean(localStorage.getItem(`plugin-enabled:${pluginItem.id}`));
        });
        return initialDisabledMap;
    });

    const handleRestartStatusUpdate = useCallback((pluginName: string, requiresRestart: boolean, changeSource: RestartSourceType) => {
        setRestartSourcesMap(previousMap => {
            const updatedMap = { ...previousMap };
            const currentSources = new Set(updatedMap[pluginName]);
            if (requiresRestart) {
                currentSources.add(changeSource);
            } else {
                currentSources.delete(changeSource);
            }
            if (currentSources.size > 0) {
                updatedMap[pluginName] = currentSources;
            } else {
                delete updatedMap[pluginName];
            }
            return updatedMap;
        });
    }, []);

    const handlePluginStatusToggle = useCallback((pluginName: string, isDisabled: boolean) => {
        setDisabledPluginsMap(previousMap => ({
            ...previousMap,
            [pluginName]: isDisabled,
        }));
    }, []);

    const handleFilterOptionChange = useCallback((selectedOption: FilterOptionType) => {
        setFilterDisplayOption(selectedOption);
    }, []);

    const visiblePlugins = useMemo(() => allPlugins.filter(pluginItem => pluginItem.visible !== false), []);

    const filteredPluginsList = useMemo(() => {
        const searchLowerCase = filterSearchText.toLowerCase();
        const searchResults = visiblePlugins.filter(pluginItem =>
            pluginItem.name.toLowerCase().includes(searchLowerCase) ||
            pluginItem.description.toLowerCase().includes(searchLowerCase)
        );

        if (filterDisplayOption === "show_all") {
            return searchResults;
        }

        return searchResults.filter(pluginItem => {
            const disabledStatus = disabledPluginsMap[pluginItem.id];
            return filterDisplayOption === "show_enabled" ? !disabledStatus : disabledStatus;
        });
    }, [filterSearchText, visiblePlugins, filterDisplayOption, disabledPluginsMap]);

    const pluginSections = useMemo(() => {
        const optionalPlugins = filteredPluginsList.filter(pluginItem => !pluginItem.required).sort((a, b) => a.name.localeCompare(b.name));
        const requiredPluginsList = filteredPluginsList.filter(pluginItem => pluginItem.required).sort((a, b) => a.name.localeCompare(b.name));

        return [
            { title: "Filters", items: [] as IPlugin[] },
            { title: "Plugins", items: optionalPlugins },
            { title: "Required Plugins", items: requiredPluginsList },
        ].filter(sectionItem => sectionItem.title === "Filters" || sectionItem.items.length > 0);
    }, [filteredPluginsList]);

    const pendingRestartMap = useMemo(
        () =>
            Object.keys(restartSourcesMap).reduce((accumulator, key) => {
                accumulator[key] = true;
                return accumulator;
            }, {} as Record<string, boolean>),
        [restartSourcesMap]
    );

    return {
        filterText: filterSearchText,
        setFilterText: setFilterSearchText,
        filterOption: filterDisplayOption,
        setFilterOption: handleFilterOptionChange,
        pendingChanges: pendingRestartMap,
        sections: pluginSections,
        handleRestartChange: handleRestartStatusUpdate,
        handlePluginToggle: handlePluginStatusToggle,
    };
};
