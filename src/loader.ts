/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/logger";
import { type IPlugin, type IPluginContext, type PluginOptions, plugins as staticPlugins } from "@utils/types";

const DEFAULT_CONFIG = {
    loadDelayMs: 100,
    parallelLoading: true,
    maxConcurrent: 5,
    maxRetries: 3,
    retryDelayMs: 1000,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeoutMs: 30000,
    domReadyTimeoutMs: 10000,
    pluginLoadTimeoutMs: 15000,
} as const;

const STORAGE_KEYS = {
    PLUGIN_ENABLED: (id: string) => `plugin-enabled:${id}`,
    PLUGIN_SETTINGS: (id: string) => `plugin-settings:${id}`,
} as const;

const _ERROR_CODES = {
    DOM_NOT_READY: "DOM_NOT_READY",
    PLUGIN_LOAD_FAILED: "PLUGIN_LOAD_FAILED",
    PLUGIN_START_FAILED: "PLUGIN_START_FAILED",
    CONFIG_INVALID: "CONFIG_INVALID",
    CIRCUIT_BREAKER_OPEN: "CIRCUIT_BREAKER_OPEN",
    TIMEOUT: "TIMEOUT",
    MEMORY_ERROR: "MEMORY_ERROR",
} as const;

declare const process: {
    readonly env: {
        readonly PLUGIN_MANAGER_LOAD_DELAY_MS?: string;
        readonly PLUGIN_MANAGER_PARALLEL_LOADING?: string;
        readonly PLUGIN_MANAGER_MAX_CONCURRENT?: string;
        readonly PLUGIN_MANAGER_MAX_RETRIES?: string;
        readonly PLUGIN_MANAGER_RETRY_DELAY_MS?: string;
        readonly PLUGIN_MANAGER_CIRCUIT_BREAKER_THRESHOLD?: string;
        readonly PLUGIN_MANAGER_CIRCUIT_BREAKER_TIMEOUT_MS?: string;
    };
};

type Result<T, E = Error> = { success: true; data: T; } | { success: false; error: E; };

type PluginModule = { default?: IPlugin; plugins?: IPlugin[]; };

type PluginLoadState = "pending" | "loading" | "loaded" | "failed" | "disabled";

type CircuitBreakerState = "closed" | "open" | "half-open";

interface PluginManagerMetrics {
    readonly startTime: number;
    pluginsLoaded: number;
    pluginsFailed: number;
    totalLoadTime: number;
    memoryUsage: number;
    domReady?: number;
    pluginsStart?: number;
    pluginsEnd?: number;
}

interface _CircuitBreaker {
    readonly state: CircuitBreakerState;
    readonly failureCount: number;
    readonly lastFailureTime: number;
    readonly threshold: number;
    readonly timeoutMs: number;
}

interface MutableCircuitBreaker extends Omit<_CircuitBreaker, "state" | "failureCount" | "lastFailureTime"> {
    state: CircuitBreakerState;
    failureCount: number;
    lastFailureTime: number;
}

interface PluginLoadContext extends IPluginContext<PluginOptions> {
    readonly loadStartTime: number;
    readonly retryCount: number;
    readonly maxRetries: number;
}

interface PluginManagerConfig {
    readonly loadDelayMs: number;
    readonly parallelLoading: boolean;
    readonly maxConcurrent: number;
    readonly maxRetries: number;
    readonly retryDelayMs: number;
    readonly circuitBreakerThreshold: number;
    readonly circuitBreakerTimeoutMs: number;
    readonly domReadyTimeoutMs: number;
    readonly pluginLoadTimeoutMs: number;
}

class PluginManagerError extends Error {
    public readonly code: keyof typeof _ERROR_CODES;
    public readonly timestamp: number;
    public readonly context?: Record<string, unknown>;

    constructor(code: keyof typeof _ERROR_CODES, message: string, context?: Record<string, unknown>) {
        super(message);
        this.name = "PluginManagerError";
        this.code = code;
        this.timestamp = Date.now();
        this.context = context;
    }
}

class CircuitBreakerError extends PluginManagerError {
    constructor(context?: Record<string, unknown>) {
        super("CIRCUIT_BREAKER_OPEN", "Circuit breaker is open", context);
    }
}

class TimeoutError extends PluginManagerError {
    constructor(operation: string, timeoutMs: number) {
        super("TIMEOUT", `${operation} timed out after ${timeoutMs}ms`, { operation, timeoutMs });
    }
}

function createResult<T, E = Error>(data: T): Result<T, E> {
    return { success: true, data };
}

function createError<T, E = Error>(error: E): Result<T, E> {
    return { success: false, error };
}

function isPlugin(obj: unknown): obj is IPlugin {
    return (
        typeof obj === "object" &&
        obj !== null &&
        typeof (obj as IPlugin).id === "string" &&
        typeof (obj as IPlugin).name === "string" &&
        typeof (obj as IPlugin).start === "function"
    );
}

function isPluginModule(obj: unknown): obj is PluginModule {
    return (
        typeof obj === "object" &&
        obj !== null &&
        ("default" in obj || "plugins" in obj)
    );
}

function parseEnvNumber(value: string | undefined, defaultValue: number): number {
    if (!value) {
        return defaultValue;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : Math.max(0, parsed);
}

function parseEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) {
        return defaultValue;
    }
    return value.toLowerCase() !== "false";
}

async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string
): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new TimeoutError(operation, timeoutMs)), timeoutMs)
    );
    return Promise.race([promise, timeout]);
}

interface PerformanceMemory {
    readonly usedJSHeapSize: number;
    readonly totalJSHeapSize: number;
    readonly jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
    readonly memory?: PerformanceMemory;
}

function measureMemoryUsage(): number {
    const performanceWithMemory = performance as PerformanceWithMemory;
    return performanceWithMemory.memory?.usedJSHeapSize || 0;
}

class DOMReadyDetector {
    private readonly logger: Logger;
    private readonly timeoutMs: number;
    private readonly observer: MutationObserver;
    private resolvePromise?: () => void;
    private rejectPromise?: (error: Error) => void;
    private readyPromise?: Promise<void>;

    constructor(logger: Logger, timeoutMs: number = DEFAULT_CONFIG.domReadyTimeoutMs) {
        this.logger = logger;
        this.timeoutMs = timeoutMs;
        this.observer = new MutationObserver(() => this.checkReadiness());
    }

    public async waitForReady(): Promise<void> {
        if (this.readyPromise) {
            return this.readyPromise;
        }

        this.readyPromise = new Promise<void>((resolve, reject) => {
            this.resolvePromise = resolve;
            this.rejectPromise = reject;

            setTimeout(() => {
                if (this.rejectPromise) {
                    this.rejectPromise(new TimeoutError("DOM readiness detection", this.timeoutMs));
                    this.cleanup();
                }
            }, this.timeoutMs);

            if (this.isReady()) {
                resolve();
                this.cleanup();
                return;
            }

            if (!document.head) {
                this.observer.observe(document, {
                    childList: true,
                    subtree: true,
                });
            }

            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => this.checkReadiness());
                window.addEventListener("load", () => this.checkReadiness());
            }
        });

        return this.readyPromise;
    }

    private isReady(): boolean {
        return !!(document.head && document.body);
    }

    private checkReadiness(): void {
        if (this.isReady() && this.resolvePromise) {
            this.resolvePromise();
            this.cleanup();
        }
    }

    private cleanup(): void {
        this.observer.disconnect();
        this.resolvePromise = undefined;
        this.rejectPromise = undefined;
    }

    public dispose(): void {
        this.cleanup();
        if (this.rejectPromise) {
            this.rejectPromise(new Error("DOMReadyDetector disposed"));
        }
    }
}

class CircuitBreakerImpl implements MutableCircuitBreaker {
    public state: CircuitBreakerState;
    public failureCount: number = 0;
    public lastFailureTime: number = 0;

    constructor(
        public readonly threshold: number,
        public readonly timeoutMs: number
    ) {
        this.state = "closed";
    }

    public canExecute(): boolean {
        if (this.state === "closed") {
            return true;
        }
        if (this.state === "open") {
            const now = Date.now();
            if (now - this.lastFailureTime >= this.timeoutMs) {
                this.state = "half-open";
                return true;
            }
            return false;
        }
        return true;
    }

    public recordSuccess(): void {
        this.failureCount = 0;
        this.state = "closed";
    }

    public recordFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.threshold) {
            this.state = "open";
        }
    }
}

class PluginRegistry {
    private readonly plugins = new Map<string, IPlugin>();
    private readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    public register(plugin: IPlugin): void {
        if (this.plugins.has(plugin.id)) {
            // this.logger.warn(`Plugin ${plugin.id} already registered, skipping duplicate`);
            return;
        }
        this.plugins.set(plugin.id, plugin);
    }

    public get(id: string): IPlugin | undefined {
        return this.plugins.get(id);
    }

    public getAll(): readonly IPlugin[] {
        return Array.from(this.plugins.values());
    }

    public has(id: string): boolean {
        return this.plugins.has(id);
    }

    public size(): number {
        return this.plugins.size;
    }

    public clear(): void {
        this.plugins.clear();
    }
}

class PluginLoader {
    private readonly logger: Logger;
    private readonly config: PluginManagerConfig;
    private readonly circuitBreaker: CircuitBreakerImpl;
    private readonly registry: PluginRegistry;
    private readonly activePlugins = new Map<string, IPlugin>();
    private readonly pluginStates = new Map<string, PluginLoadState>();

    constructor(logger: Logger, config: PluginManagerConfig, registry: PluginRegistry) {
        this.logger = logger;
        this.config = config;
        this.circuitBreaker = new CircuitBreakerImpl(
            config.circuitBreakerThreshold,
            config.circuitBreakerTimeoutMs
        );
        this.registry = registry;
    }

    public async loadPlugin(plugin: IPlugin, retryCount = 0): Promise<Result<void>> {
        const key = STORAGE_KEYS.PLUGIN_ENABLED(plugin.id);
        const ctx: PluginLoadContext = {
            storageKey: key,
            pluginId: plugin.id,
            pluginName: plugin.name,
            startTime: Date.now(),
            settings: plugin.options,
            loadStartTime: Date.now(),
            retryCount,
            maxRetries: this.config.maxRetries,
        };

        if (!this.circuitBreaker.canExecute()) {
            return createError(new CircuitBreakerError({ pluginId: plugin.id }));
        }

        this.pluginStates.set(plugin.id, "loading");

        try {
            this.logger.info(`Starting plugin: ${plugin.name} (attempt ${retryCount + 1}/${this.config.maxRetries + 1})`);

            const loadPromise = plugin.start?.(ctx) ?? Promise.resolve();
            await withTimeout(loadPromise, this.config.pluginLoadTimeoutMs, `Plugin ${plugin.name} load`);

            this.activePlugins.set(plugin.id, plugin);
            this.pluginStates.set(plugin.id, "loaded");
            this.circuitBreaker.recordSuccess();

            this.logger.info(`Successfully loaded plugin: ${plugin.name} (${Date.now() - ctx.loadStartTime}ms)`);

            if (this.config.loadDelayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, this.config.loadDelayMs));
            }

            return createResult(undefined);
        } catch (error) {
            this.logger.error(`Failed to load plugin ${plugin.name}:`, error);
            this.pluginStates.set(plugin.id, "failed");
            this.circuitBreaker.recordFailure();

            if (!plugin.required && retryCount < this.config.maxRetries) {
                this.logger.info(`Retrying plugin ${plugin.name} in ${this.config.retryDelayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs * Math.pow(2, retryCount)));
                return this.loadPlugin(plugin, retryCount + 1);
            }

            if (!plugin.required) {
                localStorage.removeItem(key);
                this.logger.info(`Disabled plugin ${plugin.name} due to repeated failures`);
            }

            return createError(error as Error);
        }
    }

    public async unloadPlugin(plugin: IPlugin): Promise<Result<void>> {
        const key = STORAGE_KEYS.PLUGIN_ENABLED(plugin.id);
        const ctx: IPluginContext = {
            storageKey: key,
            pluginId: plugin.id,
            pluginName: plugin.name,
            startTime: Date.now(),
            settings: plugin.options,
        };

        try {
            if (plugin.stop) {
                await plugin.stop(ctx);
            }
            this.activePlugins.delete(plugin.id);
            this.pluginStates.delete(plugin.id);
            return createResult(undefined);
        } catch (error) {
            this.logger.error(`Error stopping plugin ${plugin.name}:`, error);
            return createError(error as Error);
        }
    }

    public getActivePlugins(): readonly IPlugin[] {
        return Array.from(this.activePlugins.values());
    }

    public getPluginState(id: string): PluginLoadState {
        return this.pluginStates.get(id) ?? "pending";
    }

    public dispose(): void {
        this.activePlugins.clear();
        this.pluginStates.clear();
    }
}

export class PluginManager {
    public readonly logger: Logger;
    private readonly config: PluginManagerConfig;
    private readonly registry: PluginRegistry;
    private readonly loader: PluginLoader;
    private readonly domReady: DOMReadyDetector;
    private readonly metrics: PluginManagerMetrics;
    private isInitialized = false;

    constructor(config: Partial<PluginManagerConfig> = {}, logger?: Logger) {
        this.logger = logger ?? new Logger("PluginManager", "#a6d189");
        this.config = this.buildConfig(config);
        this.validateConfig();

        this.registry = new PluginRegistry(this.logger);
        this.loader = new PluginLoader(this.logger, this.config, this.registry);
        this.domReady = new DOMReadyDetector(this.logger, this.config.domReadyTimeoutMs);

        this.metrics = {
            startTime: Date.now(),
            pluginsLoaded: 0,
            pluginsFailed: 0,
            totalLoadTime: 0,
            memoryUsage: measureMemoryUsage(),
        } as const;
    }

    private buildConfig(_partial: Partial<PluginManagerConfig>): PluginManagerConfig {
        const env = (typeof process !== "undefined" && process.env) ? process.env : {};

        return {
            loadDelayMs: parseEnvNumber(env.PLUGIN_MANAGER_LOAD_DELAY_MS, DEFAULT_CONFIG.loadDelayMs),
            parallelLoading: parseEnvBoolean(env.PLUGIN_MANAGER_PARALLEL_LOADING, DEFAULT_CONFIG.parallelLoading),
            maxConcurrent: parseEnvNumber(env.PLUGIN_MANAGER_MAX_CONCURRENT, DEFAULT_CONFIG.maxConcurrent),
            maxRetries: parseEnvNumber(env.PLUGIN_MANAGER_MAX_RETRIES, DEFAULT_CONFIG.maxRetries),
            retryDelayMs: parseEnvNumber(env.PLUGIN_MANAGER_RETRY_DELAY_MS, DEFAULT_CONFIG.retryDelayMs),
            circuitBreakerThreshold: parseEnvNumber(env.PLUGIN_MANAGER_CIRCUIT_BREAKER_THRESHOLD, DEFAULT_CONFIG.circuitBreakerThreshold),
            circuitBreakerTimeoutMs: parseEnvNumber(env.PLUGIN_MANAGER_CIRCUIT_BREAKER_TIMEOUT_MS, DEFAULT_CONFIG.circuitBreakerTimeoutMs),
            domReadyTimeoutMs: DEFAULT_CONFIG.domReadyTimeoutMs,
            pluginLoadTimeoutMs: DEFAULT_CONFIG.pluginLoadTimeoutMs,
        };
    }

    private validateConfig(): void {
        const { config } = this;

        if (config.loadDelayMs < 0) {
            throw new PluginManagerError("CONFIG_INVALID", "loadDelayMs must be non-negative");
        }
        if (config.maxConcurrent < 1) {
            throw new PluginManagerError("CONFIG_INVALID", "maxConcurrent must be at least 1");
        }
        if (config.maxRetries < 0) {
            throw new PluginManagerError("CONFIG_INVALID", "maxRetries must be non-negative");
        }
        if (config.retryDelayMs < 0) {
            throw new PluginManagerError("CONFIG_INVALID", "retryDelayMs must be non-negative");
        }
        if (config.circuitBreakerThreshold < 1) {
            throw new PluginManagerError("CONFIG_INVALID", "circuitBreakerThreshold must be at least 1");
        }
        if (config.circuitBreakerTimeoutMs < 1000) {
            throw new PluginManagerError("CONFIG_INVALID", "circuitBreakerTimeoutMs must be at least 1000ms");
        }
    }

    private async initializePlugins(): Promise<void> {
        if (this.isInitialized) {
            this.logger.debug("Plugin system already initialized, skipping...");
            return;
        }

        for (const plugin of staticPlugins) {
            if (isPlugin(plugin)) {
                this.registry.register(plugin);
            } else {
                this.logger.warn("Invalid static plugin detected:", plugin);
            }
        }

        const pluginModuleMap: Record<string, PluginModule> = import.meta.glob(
            ["./plugins/**/index.ts", "./plugins/**/index.tsx"],
            { eager: true }
        );

        for (const [path, mod] of Object.entries(pluginModuleMap)) {
            if (!isPluginModule(mod)) {
                this.logger.warn(`Invalid plugin module at ${path}:`, mod);
                continue;
            }

            try {
                if (mod.default && isPlugin(mod.default)) {
                    this.registry.register(mod.default);
                }
                if (mod.plugins) {
                    for (const plugin of mod.plugins) {
                        if (isPlugin(plugin)) {
                            this.registry.register(plugin);
                        } else {
                            this.logger.warn(`Invalid plugin in module ${path}:`, plugin);
                        }
                    }
                }
            } catch (error) {
                this.logger.error(`Error loading plugin module ${path}:`, error);
            }
        }

        this.isInitialized = true;
    }

    private getEnabledPlugins(): IPlugin[] {
        return this.registry.getAll().filter(plugin => {
            if (plugin.required) {
                return true;
            }

            const key = STORAGE_KEYS.PLUGIN_ENABLED(plugin.id);
            const stored = localStorage.getItem(key);

            if (stored === "1") {
                return true;
            }
            if (stored === "0") {
                return false;
            }
            return plugin.enabledByDefault ?? false;
        });
    }

    public async loadPlugins(): Promise<Result<void>> {
        const loadStart = Date.now();

        try {
            await this.domReady.waitForReady();
            this.metrics.domReady = Date.now();

            await this.initializePlugins();
            this.metrics.pluginsStart = Date.now();

            const enabledPlugins = this.getEnabledPlugins();
            const required = enabledPlugins.filter(p => p.required);
            const optional = enabledPlugins.filter(p => !p.required);

            for (const plugin of required) {
                const result = await this.loader.loadPlugin(plugin);
                if (result.success) {
                    this.metrics.pluginsLoaded++;
                } else {
                    this.metrics.pluginsFailed++;
                    this.logger.error(`Failed to load required plugin ${plugin.name}:`, result.error);
                    return result;
                }
            }

            if (this.config.parallelLoading) {
                await this.loadInParallel(optional);
            } else {
                for (const plugin of optional) {
                    const result = await this.loader.loadPlugin(plugin);
                    if (result.success) {
                        this.metrics.pluginsLoaded++;
                    } else {
                        this.metrics.pluginsFailed++;
                    }
                }
            }

            this.metrics.pluginsEnd = Date.now();
            this.metrics.totalLoadTime = this.metrics.pluginsEnd - loadStart;
            this.metrics.memoryUsage = measureMemoryUsage();

            this.logger.info("All plugins loaded successfully", {
                loaded: this.metrics.pluginsLoaded,
                failed: this.metrics.pluginsFailed,
                totalTime: this.metrics.totalLoadTime,
                memoryUsage: this.metrics.memoryUsage,
            });

            return createResult(undefined);
        } catch (error) {
            this.metrics.pluginsFailed++;
            this.logger.error("Failed to load plugins:", error);
            return createError(error as Error);
        }
    }

    private async loadInParallel(plugins: IPlugin[]): Promise<void> {
        const queue = [...plugins];
        const workers = Array.from({ length: Math.min(this.config.maxConcurrent, plugins.length) }, () =>
            this.processQueue(queue)
        );
        await Promise.all(workers);
    }

    private async processQueue(queue: IPlugin[]): Promise<void> {
        while (queue.length > 0) {
            const plugin = queue.shift();
            if (plugin) {
                const result = await this.loader.loadPlugin(plugin);
                if (result.success) {
                    this.metrics.pluginsLoaded++;
                } else {
                    this.metrics.pluginsFailed++;
                }
            }
        }
    }

    public async unload(): Promise<Result<void>> {
        try {
            this.logger.info("Unloading all plugins...");

            for (const plugin of this.loader.getActivePlugins()) {
                await this.loader.unloadPlugin(plugin);
            }

            this.domReady.dispose();
            this.loader.dispose();

            this.logger.info("All plugins unloaded successfully");
            return createResult(undefined);
        } catch (error) {
            this.logger.error("Error during plugin unload:", error);
            return createError(error as Error);
        }
    }

    public getMetrics(): Readonly<PluginManagerMetrics> {
        return { ...this.metrics };
    }

    public getActivePlugins(): readonly IPlugin[] {
        return this.loader.getActivePlugins();
    }

    public dispose(): void {
        this.domReady.dispose();
        this.loader.dispose();
        this.registry.clear();
        const initKey = "grokness_initialized";
        delete (window as unknown as Record<string, unknown>)[initKey];
    }
}

async function initializePluginManager(): Promise<void> {
    const initKey = "grokness_initialized";
    const globalWindow = window as unknown as Record<string, unknown>;
    if (globalWindow[initKey]) {
        console.info("Grokness plugin system already initialized, skipping...");
        return;
    }
    globalWindow[initKey] = true;

    const logger = new Logger("PluginManager", "#a6d189");
    const manager = new PluginManager({}, logger);

    try {
        window.addEventListener("error", event => {
            logger.error("Global error:", event.error);
        });

        window.addEventListener("unhandledrejection", event => {
            logger.error("Unhandled promise rejection:", event.reason);
        });

        window.addEventListener("beforeunload", () => {
            manager.dispose();
        });

        const result = await manager.loadPlugins();

        if (!result.success) {
            logger.error("Failed to initialize plugin manager:", result.error);
        }

        if (import.meta.env?.DEV) {
            (window as Window & { groknessPluginManager?: PluginManager; }).groknessPluginManager = manager;
        }

    } catch (error) {
        logger.error("Critical error during initialization:", error);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePluginManager);
} else {
    initializePluginManager().catch(error => {
        console.error("Failed to initialize plugin manager:", error);
    });
}

