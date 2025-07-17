/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Build-time injected environment for config overrides
declare const process: {
    env: {
        PLUGIN_MANAGER_LOAD_DELAY_MS?: string;
        PLUGIN_MANAGER_PARALLEL_LOADING?: string;
        PLUGIN_MANAGER_MAX_CONCURRENT?: string;
    };
};

import { Logger } from "@utils/logger";
import { type IPlugin, type IPluginContext, plugins as staticPlugins } from "@utils/types";

// Dynamically discover plugin modules in ./plugins/**/index.ts(x)
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

/**
 * All plugins (static + dynamically discovered)
 */
// Merge static and dynamic plugins, deduplicating by id
const allPlugins: IPlugin[] = (() => {
    const pluginMap = new Map<string, IPlugin>();
    for (const plugin of staticPlugins) {
        pluginMap.set(plugin.id, plugin);
    }
    for (const plugin of dynamicPlugins) {
        if (pluginMap.has(plugin.id)) {
            console.warn(`Skipping duplicate plugin load for id: ${plugin.id}`);
        } else {
            pluginMap.set(plugin.id, plugin);
        }
    }
    return Array.from(pluginMap.values());
})();

/**
 * Configuration options for the PluginManager.
 * These can be overridden via constructor or build-time injected env variables.
 */
export interface PluginManagerConfig {
    /** Delay in ms between starting each plugin to prevent overload. */
    loadDelayMs: number;
    /** Whether to load plugins in parallel (true) or sequentially (false). */
    parallelLoading: boolean;
    /** Maximum concurrent plugin loads if parallel. */
    maxConcurrent: number;
    /** Path to custom config file (optional). */
    configPath?: string;
}

/**
 * Build-time environment stub or runtime guard
 */
const env = (typeof process !== "undefined" && process.env) ? process.env : {};

/**
 * Default configuration values.
 * Can be overridden by build-time environment variables.
 */
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

/**
 * Modern, modular PluginManager for loading and managing plugins.
 */
export class PluginManager {
    /** Logger instance (public to allow external error reporting) */
    public readonly logger: Logger;
    private readonly config: PluginManagerConfig;
    private readonly activePlugins = new Map<string, IPlugin>();

    /**
     * Creates a new PluginManager instance.
     * @param config Optional partial config to override defaults.
     * @param logger Optional custom logger instance.
     */
    constructor(
        config: Partial<PluginManagerConfig> = {},
        logger?: Logger
    ) {
        this.config = { ...defaultConfig, ...config };
        this.logger = logger ?? new Logger("PluginManager", "#a6d189");
        this.validateConfig();
    }

    /**
     * Validates the configuration values.
     * Throws if invalid.
     */
    private validateConfig(): void {
        if (this.config.loadDelayMs < 0) {
            throw new Error("loadDelayMs must be non-negative");
        }
        if (this.config.maxConcurrent < 1) {
            throw new Error("maxConcurrent must be at least 1");
        }
    }

    /**
     * Loads and starts all enabled plugins.
     * Handles required plugins first, then optional enabled ones.
     */
    public async loadPlugins(): Promise<void> {
        const enabled = this.getEnabledPlugins();
        this.logger.info(`Loading ${enabled.length} plugins...`);

        // Load required plugins first (sequentially for safety)
        const required = enabled.filter(p => p.required);
        for (const plugin of required) {
            await this.startPlugin(plugin);
        }

        // Load optional plugins based on config
        const optional = enabled.filter(p => !p.required);
        if (this.config.parallelLoading) {
            await this.loadInParallel(optional);
        } else {
            for (const plugin of optional) {
                await this.startPlugin(plugin);
            }
        }
    }

    /**
     * Retrieves the list of plugins that should be loaded.
     */
    private getEnabledPlugins(): IPlugin[] {
        return allPlugins.filter(plugin => {
            if (plugin.required) {
                return true;
            }
            const key = this.getStorageKey(plugin);
            return !localStorage.getItem(key);
        });
    }

    /**
     * Starts a single plugin with error isolation and optional disable on failure.
     * @param plugin Plugin to start.
     */
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
                localStorage.setItem(key, "1");
                this.logger.info(`Disabled ${plugin.name} due to error.`);
            }
        }
    }

    /**
     * Loads plugins in parallel with a concurrency limit.
     * @param pluginsToLoad Plugins to load.
     */
    private async loadInParallel(
        pluginsToLoad: IPlugin[]
    ): Promise<void> {
        const queue = [...pluginsToLoad];
        const workers = Array.from({ length: this.config.maxConcurrent }, () =>
            this.processQueue(queue)
        );
        await Promise.all(workers);
    }

    /**
     * Worker function to process plugin queue.
     */
    private async processQueue(queue: IPlugin[]): Promise<void> {
        while (queue.length > 0) {
            const plugin = queue.shift();
            if (plugin) {
                await this.startPlugin(plugin);
            }
        }
    }

    /**
     * Generates a storage key for plugin disabled state.
     */
    private getStorageKey(plugin: IPlugin): string {
        return `plugin-disabled:${plugin.id}`;
    }

    /**
     * Simple async delay utility.
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Stops all active plugins and cleans up.
     */
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

// Auto-initialize and load plugins
const manager = new PluginManager();
manager.loadPlugins().catch(error => {
    manager.logger.error("Failed to load plugins:", error);
});
