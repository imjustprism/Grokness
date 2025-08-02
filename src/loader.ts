/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/logger";
import { type IPlugin, type IPluginContext, plugins as staticPlugins } from "@utils/types";

declare const process: {
    env: {
        PLUGIN_MANAGER_LOAD_DELAY_MS?: string;
        PLUGIN_MANAGER_PARALLEL_LOADING?: string;
        PLUGIN_MANAGER_MAX_CONCURRENT?: string;
    };
};

const pluginModuleMap: Record<string, { default?: IPlugin; plugins?: IPlugin[]; }> = import.meta.glob(
    ["./plugins/**/index.ts", "./plugins/**/index.tsx"],
    { eager: true }
);

const dynamicPlugins: IPlugin[] = Object.values(pluginModuleMap).flatMap(mod => {
    if (mod.default) {
        return [mod.default];
    }
    if (mod.plugins) {
        return mod.plugins;
    }
    return [];
});

const allPlugins: IPlugin[] = (() => {
    const pluginMap = new Map<string, IPlugin>();
    for (const plugin of staticPlugins) {
        pluginMap.set(plugin.id, plugin);
    }
    for (const plugin of dynamicPlugins) {
        if (pluginMap.has(plugin.id)) {
            const existing = pluginMap.get(plugin.id);
            if (existing !== plugin) {
                console.warn(`Skipping duplicate plugin load for id: ${plugin.id}`);
            }
        } else {
            pluginMap.set(plugin.id, plugin);
        }
    }
    return Array.from(pluginMap.values());
})();

export interface PluginManagerConfig {
    loadDelayMs: number;
    parallelLoading: boolean;
    maxConcurrent: number;
    configPath?: string;
}

const env = (typeof process !== "undefined" && process.env) ? process.env : {};

const defaultConfig: PluginManagerConfig = {
    loadDelayMs: env.PLUGIN_MANAGER_LOAD_DELAY_MS
        ? parseInt(env.PLUGIN_MANAGER_LOAD_DELAY_MS, 10)
        : 100,
    parallelLoading:
        env.PLUGIN_MANAGER_PARALLEL_LOADING !== "false",
    maxConcurrent: env.PLUGIN_MANAGER_MAX_CONCURRENT
        ? parseInt(env.PLUGIN_MANAGER_MAX_CONCURRENT, 10)
        : 5,
};

export class PluginManager {
    public readonly logger: Logger;
    private readonly config: PluginManagerConfig;
    private readonly activePlugins = new Map<string, IPlugin>();

    constructor(
        config: Partial<PluginManagerConfig> = {},
        logger?: Logger
    ) {
        this.config = { ...defaultConfig, ...config };
        this.logger = logger ?? new Logger("PluginManager", "#a6d189");
        this.validateConfig();
    }

    private validateConfig(): void {
        if (this.config.loadDelayMs < 0) {
            throw new Error("loadDelayMs must be non-negative");
        }
        if (this.config.maxConcurrent < 1) {
            throw new Error("maxConcurrent must be at least 1");
        }
    }

    public async loadPlugins(): Promise<void> {
        const enabled = this.getEnabledPlugins();
        const required = enabled.filter(p => p.required);
        for (const plugin of required) {
            await this.startPlugin(plugin);
        }
        const optional = enabled.filter(p => !p.required);
        if (this.config.parallelLoading) {
            await this.loadInParallel(optional);
        } else {
            for (const plugin of optional) {
                await this.startPlugin(plugin);
            }
        }
    }

    private getEnabledPlugins(): IPlugin[] {
        return allPlugins.filter(plugin => {
            if (plugin.required) {
                return true;
            }
            const key = this.getStorageKey(plugin);
            return !!localStorage.getItem(key);
        });
    }

    private async startPlugin(plugin: IPlugin): Promise<void> {
        const key = this.getStorageKey(plugin);
        const ctx: IPluginContext = { storageKey: key };
        try {
            this.logger.info(`Starting plugin: ${plugin.name}`);
            await plugin.start?.(ctx);
            this.activePlugins.set(plugin.id, plugin);
            await this.delay(this.config.loadDelayMs);
        } catch (error) {
            this.logger.error(`Error starting ${plugin.name}:`, error);
            if (!plugin.required) {
                localStorage.removeItem(key);
                this.logger.info(`Disabled ${plugin.name} due to error.`);
            }
        }
    }

    private async loadInParallel(
        pluginsToLoad: IPlugin[]
    ): Promise<void> {
        const queue = [...pluginsToLoad];
        const workers = Array.from({ length: this.config.maxConcurrent }, () =>
            this.processQueue(queue)
        );
        await Promise.all(workers);
    }

    private async processQueue(queue: IPlugin[]): Promise<void> {
        while (queue.length > 0) {
            const plugin = queue.shift();
            if (plugin) {
                await this.startPlugin(plugin);
            }
        }
    }

    private getStorageKey(plugin: IPlugin): string {
        return `plugin-enabled:${plugin.id}`;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public async unload(): Promise<void> {
        for (const plugin of this.activePlugins.values()) {
            const key = this.getStorageKey(plugin);
            const ctx: IPluginContext = { storageKey: key };
            try {
                await plugin.stop?.(ctx);
            } catch (error) {
                this.logger.error(`Error stopping ${plugin.name}:`, error);
            }
        }
        this.activePlugins.clear();
    }
}

const manager = new PluginManager();
manager.loadPlugins().catch(error => {
    manager.logger.error("Failed to load plugins:", error);
});
