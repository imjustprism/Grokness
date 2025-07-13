/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./index";

import { Logger } from "@utils/logger";
import { type IPlugin, type IPluginContext, plugins } from "@utils/types";

const pluginManagerLogger = new Logger("PluginManager", "#a6d189");

function getPluginStorageKey(plugin: IPlugin): string {
    return `plugin-disabled:${plugin.id}`;
}

function loadEnabledPlugins(): IPlugin[] {
    return plugins.filter(plugin => {
        if (plugin.required) {
            return true;
        }
        const disabledFlag = localStorage.getItem(getPluginStorageKey(plugin));
        return !disabledFlag;
    });
}

const enabledPlugins = loadEnabledPlugins();
if (enabledPlugins.length === 0) {
    pluginManagerLogger.warn("No plugins loaded.");
}

enabledPlugins.forEach(plugin => {
    pluginManagerLogger.info(`Starting plugin: ${plugin.name}`);
    try {
        const ctx: IPluginContext = {
            storageKey: getPluginStorageKey(plugin),
        };
        plugin.start(ctx);
    } catch (err) {
        pluginManagerLogger.error(`Error starting ${plugin.name}:`, err);
        if (!plugin.required) {
            localStorage.setItem(getPluginStorageKey(plugin), "1");
            pluginManagerLogger.info(`Disabled plugin ${plugin.name} due to startup failure.`);
        }
    }
});
