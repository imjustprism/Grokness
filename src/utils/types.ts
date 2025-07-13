import { type IDeveloper } from "@utils/constants";
import { getPluginSetting, initializePluginSettings } from "@utils/settings";

export enum PluginCategory {
    Utility = "utility",
    Appearance = "appearance",
    Chat = "chat",
    Moderation = "moderation",
    Integration = "integration",
    Experimental = "experimental",
    Other = "other",
}

export type PluginOptionType =
    | "string"
    | "number"
    | "boolean"
    | "select"
    | "custom";

export interface PluginOptionBase {
    type: PluginOptionType;
    description: string;
    displayName?: string;
    default?: unknown;
    options?: readonly { label: string; value: unknown; }[];
    [key: string]: unknown;
}

export type PluginOptions = Record<string, PluginOptionBase>;

export type InferOptionType<O extends PluginOptionBase> =
    O["type"] extends "boolean" ? boolean :
    O["type"] extends "number" ? number :
    O["type"] extends "string" ? string :
    O["type"] extends "select" ? O["options"] extends readonly { value: infer V; }[] ? V : unknown :
    unknown; // fallback for 'custom'

export interface IPatch {
    apply(): void;
    remove?(): void;
}

export interface ISettingsManager<T extends PluginOptions = PluginOptions> {
    definition: T;
    store: { [K in keyof T]: InferOptionType<T[K]> };
}

export interface IPluginContext {
    readonly storageKey: string;
}

export interface IPluginDefinition {
    /** Unique plugin id (auto-generated from name if not provided) */
    id?: string;
    /** Display name */
    name: string;
    /** Description */
    description: string;
    /** Authors (see constants.ts) */
    authors: IDeveloper[];
    /** Category/type for filtering */
    category?: PluginCategory | string;
    /** Tags for search/filtering */
    tags?: string[];
    /** Plugin dependencies (by id/name) */
    dependencies?: string[];
    /** Show in UI */
    visible?: boolean;
    /** Enabled by default */
    enabledByDefault?: boolean;
    /** Requires restart to enable/disable */
    requiresRestart?: boolean;
    /** Force enabled, cannot be disabled */
    required?: boolean;
    /** Hide from UI */
    hidden?: boolean;
    /** DEPRECATED: Use `settings` property instead */
    options?: PluginOptions;
    /** Settings manager for the plugin */
    settings?: ISettingsManager;
    /** Patches (core logic) */
    patches: IPatch[];
    /** Start/stop hooks */
    start?(context: IPluginContext): void;
    stop?(context: IPluginContext): void;
    /** Lifecycle hooks */
    onLoad?(context: IPluginContext): void;
    onUnload?(context: IPluginContext): void;
}

// --- Plugin Runtime Type (resolved, all fields present) ---
export interface IPlugin {
    id: string;
    name: string;
    description: string;
    authors: IDeveloper[];
    category: PluginCategory | string;
    tags: string[];
    dependencies: string[];
    visible: boolean;
    enabledByDefault: boolean;
    requiresRestart: boolean;
    required: boolean;
    hidden: boolean;
    options: PluginOptions;
    patches: IPatch[];
    start(context: IPluginContext): void;
    stop(context: IPluginContext): void;
}

export const plugins: IPlugin[] = [];

function toKebabCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
}

export function definePlugin<Def extends IPluginDefinition>(def: Def): IPlugin {
    const id = def.id || toKebabCase(def.name);
    const storageKey = `plugin-disabled:${id}`;

    // Handle settings initialization
    if (def.settings) {
        const options = def.settings.definition;
        initializePluginSettings(id, options);
        type StoreType = { [K in keyof typeof options]: InferOptionType<(typeof options)[K]> };
        def.settings.store = new Proxy({}, {
            get(_, key: string) {
                return getPluginSetting(id, key, options);
            },
        }) as StoreType;
    }

    const plugin: IPlugin = {
        id,
        name: def.name,
        description: def.description,
        authors: def.authors,
        category: def.category || PluginCategory.Other,
        tags: def.tags || [],
        dependencies: def.dependencies || [],
        visible: def.visible !== false,
        enabledByDefault: def.enabledByDefault ?? false,
        requiresRestart: !!def.requiresRestart,
        required: !!def.required,
        hidden: !!def.hidden,
        options: def.settings?.definition || def.options || {},
        patches: def.patches,
        start: ctx => {
            def.onLoad?.(ctx);
            def.start?.(ctx);
            def.patches.forEach(p => p.apply());
        },
        stop: ctx => {
            def.patches.forEach(p => {
                if (typeof p.remove === "function") {
                    p.remove!();
                }
            });
            def.stop?.(ctx);
            def.onUnload?.(ctx);
        },
    };
    plugins.push(plugin);
    if (plugin.required) {
        plugin.start({ storageKey });
        return plugin;
    }
    const disabled = Boolean(localStorage.getItem(storageKey));
    const shouldEnable = !disabled && plugin.enabledByDefault;
    if (shouldEnable) {
        plugin.start({ storageKey });
    }
    return plugin;
}
