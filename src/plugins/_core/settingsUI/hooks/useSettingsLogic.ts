/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type IPlugin, plugins as allPlugins } from "@utils/types";
import { useCallback, useMemo, useState } from "react";

type FilterOption = "show_all" | "show_enabled" | "show_disabled";
type RestartSource = "toggle" | "settings";

export const useSettingsLogic = () => {
    const [searchText, setSearchText] = useState<string>("");
    const [filterOption, setFilterOption] = useState<FilterOption>("show_all");
    const [restartSourcesByPlugin, setRestartSourcesByPlugin] = useState<Record<string, Set<RestartSource>>>({});
    const [isPluginDisabledById, setIsPluginDisabledById] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        for (const plugin of allPlugins) {
            initial[plugin.id] = plugin.required ? false : !Boolean(localStorage.getItem(`plugin-enabled:${plugin.id}`));
        }
        return initial;
    });

    const handleRestartStatusUpdate = useCallback((pluginName: string, requiresRestart: boolean, source: RestartSource) => {
        setRestartSourcesByPlugin(previous => {
            const next = { ...previous };
            const current = new Set(next[pluginName]);
            if (requiresRestart) {
                current.add(source);
            } else {
                current.delete(source);
            }
            if (current.size > 0) {
                next[pluginName] = current;
            } else {
                delete next[pluginName];
            }
            return next;
        });
    }, []);

    const handlePluginStatusToggle = useCallback((pluginName: string, isDisabled: boolean) => {
        setIsPluginDisabledById(previous => ({ ...previous, [pluginName]: isDisabled }));
    }, []);

    const handleFilterOptionChange = useCallback((option: FilterOption) => setFilterOption(option), []);

    const visiblePlugins = useMemo<IPlugin[]>(() => allPlugins.filter(p => p.visible !== false), []);

    const filteredPlugins = useMemo<IPlugin[]>(() => {
        const q = searchText.toLowerCase();
        const matchesQuery = (p: IPlugin) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
        const prelim = visiblePlugins.filter(matchesQuery);
        if (filterOption === "show_all") {
            return prelim;
        }
        return prelim.filter(p => (filterOption === "show_enabled" ? !isPluginDisabledById[p.id] : isPluginDisabledById[p.id]));
    }, [searchText, visiblePlugins, filterOption, isPluginDisabledById]);

    const sections = useMemo(() => {
        const compareByName = (a: IPlugin, b: IPlugin): number => {
            const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
            if (byName !== 0) {
                return byName;
            }
            return a.id.localeCompare(b.id);
        };
        const optional = filteredPlugins.filter(p => !p.required).sort(compareByName);
        const required = filteredPlugins.filter(p => p.required).sort(compareByName);
        return [
            { title: "Filters", items: [] as IPlugin[] },
            { title: "Plugins", items: optional },
            { title: "Required Plugins", items: required },
        ];
    }, [filteredPlugins]);

    const pendingChanges = useMemo<Record<string, boolean>>(
        () => Object.fromEntries(Object.keys(restartSourcesByPlugin).map(k => [k, true])),
        [restartSourcesByPlugin]
    );

    return {
        filterText: searchText,
        setFilterText: setSearchText,
        filterOption,
        setFilterOption: handleFilterOptionChange,
        pendingChanges,
        sections,
        handleRestartChange: handleRestartStatusUpdate,
        handlePluginToggle: handlePluginStatusToggle,
    } as const;
};
