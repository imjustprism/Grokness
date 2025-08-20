/*
 * Plugin System Types
 * Clean, type-safe plugin system with auto-generated IDs
 */

import { type IDeveloper } from "@utils/constants";
import { type AnySelector, type ElementFinderConfig, selectOne } from "@utils/dom";
import { PluginHelper } from "@utils/pluginHelper";
import React from "react";

// =============================================================================
// PLUGIN CATEGORIES
// =============================================================================

export enum PluginCategory {
    Utility = "utility",
    Appearance = "appearance",
    Chat = "chat",
    Moderation = "moderation",
    Integration = "integration",
    Experimental = "experimental",
    Developer = "developer",
    Accessibility = "accessibility",
    Other = "other",
}

// =============================================================================
// PLUGIN OPTIONS
// =============================================================================

export type PluginOptionType =
    | "string"
    | "number"
    | "slider"
    | "boolean"
    | "select"
    | "custom";

export interface PluginOptionBase {
    readonly type: PluginOptionType;
    readonly description: string;
    readonly displayName?: string;
    readonly default?: unknown;
    readonly required?: boolean;
    readonly disabled?: boolean;
    readonly hidden?: boolean;
    readonly options?: readonly { label: string; value: unknown; }[];
}

export type PluginOptions = Record<string, PluginOptionBase>;

export type InferOptionType<O extends PluginOptionBase> =
    O["type"] extends "boolean" ? boolean :
    O["type"] extends "number" | "slider" ? number :
    O["type"] extends "string" ? string :
    O["type"] extends "select" ? O["options"] extends readonly { value: infer V; }[] ? V : unknown :
    unknown;

export interface ISettingsManager<T extends PluginOptions = PluginOptions> {
    readonly definition: T;
    readonly store: Record<string, unknown>;
}

// =============================================================================
// PLUGIN CONTEXT
// =============================================================================

export interface IPluginContext<TSettings extends PluginOptions = PluginOptions> {
    readonly storageKey: string;
    readonly pluginId: string;
    readonly pluginName: string;
    readonly startTime: number;
    readonly settings: { [K in keyof TSettings]: InferOptionType<TSettings[K]> };
}

// =============================================================================
// PLUGIN DEFINITION
// =============================================================================

export interface IPluginDefinition<TSettings extends PluginOptions = PluginOptions> {
    readonly name: string;
    readonly description: string;
    readonly authors: readonly IDeveloper[];
    readonly category?: PluginCategory | string;
    readonly tags?: readonly string[];
    readonly styles?: string;
    readonly dependencies?: readonly string[];

    readonly visible?: boolean;
    readonly enabledByDefault?: boolean;
    readonly requiresRestart?: boolean;
    readonly required?: boolean;
    readonly hidden?: boolean;
    readonly experimental?: boolean;

    readonly options?: TSettings;
    readonly settings?: ISettingsManager<TSettings>;

    readonly patches?: readonly PluginPatch[];
    readonly ui?: PluginUIPatch | readonly PluginUIPatch[];

    start?(context: IPluginContext<TSettings>): void | Promise<void>;
    stop?(context: IPluginContext<TSettings>): void | Promise<void>;
    onLoad?(context: IPluginContext<TSettings>): void | Promise<void>;
    onUnload?(context: IPluginContext<TSettings>): void | Promise<void>;
    onError?(error: Error, context: IPluginContext<TSettings>): void;
    onSettingsChange?(key: string, value: unknown, context: IPluginContext<TSettings>): void;
}

// =============================================================================
// PLUGIN INTERFACE
// =============================================================================

export interface IPlugin<TSettings extends PluginOptions = PluginOptions> {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly authors: readonly IDeveloper[];
    readonly category: PluginCategory | string;
    readonly tags: readonly string[];
    readonly styles?: string;
    readonly dependencies: readonly string[];

    readonly visible: boolean;
    readonly enabledByDefault: boolean;
    readonly requiresRestart: boolean;
    readonly required: boolean;
    readonly hidden: boolean;
    readonly experimental: boolean;

    readonly options: TSettings;
    readonly patches: readonly PluginPatch[];

    start(context: IPluginContext<TSettings>): void | Promise<void>;
    stop(context: IPluginContext<TSettings>): void | Promise<void>;
    onLoad?(context: IPluginContext<TSettings>): void | Promise<void>;
    onUnload?(context: IPluginContext<TSettings>): void | Promise<void>;
    onError?(error: Error, context: IPluginContext<TSettings>): void;
    onSettingsChange?(key: string, value: unknown, context: IPluginContext<TSettings>): void;
}

// =============================================================================
// PLUGIN PATCHES
// =============================================================================

export interface IPatch {
    readonly id?: string;
    readonly description?: string;
    readonly priority?: number;
    readonly dependencies?: readonly string[];

    apply?(): void | Promise<void>;
    remove?(): void | Promise<void>;
    disconnect?(): void | Promise<void>;
    validate?(): boolean | Promise<boolean>;
}

export interface IPluginUIPatch extends IPatch {
    readonly target: string | ElementFinderConfig;
    readonly component: React.ComponentType<InjectedComponentProps>;
    readonly forEach?: boolean;
    readonly getTargetParent?: (foundElement: HTMLElement) => HTMLElement | null;
    readonly referenceNode?: (parentElement: HTMLElement, foundElement: HTMLElement) => Node | null;
    readonly observerDebounce?: boolean | number;
    readonly predicate?: (foundElement: HTMLElement) => boolean;
    readonly insertPosition?: "before" | "after" | "prepend" | "append";
}

export interface IPluginCodePatch extends IPatch {
    readonly find: string | RegExp;
    readonly replacement: {
        readonly match: RegExp;
        readonly replace: string | ((substring: string, ...args: unknown[]) => string);
    };
    readonly predicate?: () => boolean | Promise<boolean>;
    readonly all?: boolean;
    readonly group?: boolean;
    readonly noWarn?: boolean;
    readonly timeout?: number;
}

export type PluginPatch = IPatch | IPluginUIPatch | IPluginCodePatch;

export type InjectedComponentProps = {
    readonly rootElement?: HTMLElement;
    readonly context?: IPluginContext;
};

// =============================================================================
// UI PATCH SYSTEM
// =============================================================================

export type ParentSpec = AnySelector | ((foundElement: HTMLElement) => HTMLElement | null) | undefined;

export type InsertSpec =
    | { append: true; prepend: true; }
    | { after: AnySelector | ((parent: HTMLElement, found: HTMLElement) => Node | null); }
    | { before: AnySelector | ((parent: HTMLElement, found: HTMLElement) => Node | null); };

export type SimpleUIPatch = {
    readonly id?: string;
    readonly target: AnySelector;
    readonly component: React.ComponentType<InjectedComponentProps> | (() => React.ReactElement | null);
    readonly each?: boolean;
    readonly parent?: ParentSpec;
    readonly insert?: InsertSpec;
    readonly predicate?: (el: HTMLElement) => boolean;
    readonly observerDebounce?: boolean | number;
    readonly once?: boolean;
    readonly replaceExisting?: boolean;
};

export type PluginUIPatch = SimpleUIPatch | IPluginUIPatch;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function toKebabCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
}

const settingsStore = new Map<string, Record<string, unknown>>();
const pluginHelper = new PluginHelper();

// =============================================================================
// SETTINGS MANAGEMENT
// =============================================================================

export function definePluginSettings<T extends PluginOptions>(definition: T): ISettingsManager<T> {
    return {
        definition,
        store: {} as { [K in keyof T]: InferOptionType<T[K]> },
    };
}

export function getPluginSettings(pluginId: string): Record<string, unknown> {
    if (!settingsStore.has(pluginId)) {
        const stored = localStorage.getItem(`plugin-settings:${pluginId}`);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as Record<string, unknown>;
                settingsStore.set(pluginId, parsed);
                return parsed;
            } catch {
                // ignore parse error
            }
        }
        settingsStore.set(pluginId, {});
    }
    return settingsStore.get(pluginId)!;
}

export function setPluginSetting(pluginId: string, key: string, value: unknown): void {
    const settings = getPluginSettings(pluginId);
    settings[key] = value;
    localStorage.setItem(`plugin-settings:${pluginId}`, JSON.stringify(settings));
    settingsStore.set(pluginId, settings);
    window.dispatchEvent(
        new CustomEvent("grok-settings-updated", {
            detail: { pluginId, key, value },
        })
    );
}

export function getPluginSetting<T extends PluginOptions, K extends keyof T & string>(
    pluginId: string,
    key: K,
    options: T,
    defaultValue?: InferOptionType<T[K]>
): InferOptionType<T[K]> {
    const settings = getPluginSettings(pluginId);
    const option = options[key];

    if (settings[key] !== undefined) {
        return settings[key] as InferOptionType<T[K]>;
    }

    if (option?.default !== undefined) {
        return option.default as InferOptionType<T[K]>;
    }

    return defaultValue as InferOptionType<T[K]>;
}

export function initializePluginSettings(pluginId: string, options: PluginOptions): void {
    const settings = getPluginSettings(pluginId);
    let hasChanges = false;

    for (const [key, option] of Object.entries(options)) {
        if (settings[key] === undefined) {
            if (option.default !== undefined) {
                settings[key] = option.default;
                hasChanges = true;
            }
        } else {
            const stored = settings[key];
            const expectedType = option.type;
            const ok =
                (expectedType === "boolean" && typeof stored === "boolean") ||
                ((expectedType === "number" || expectedType === "slider") && typeof stored === "number") ||
                (expectedType === "string" && typeof stored === "string") ||
                (expectedType === "select" && option.options?.some(o => o.value === stored));

            if (!ok) {
                settings[key] = option.default;
                hasChanges = true;
            }
        }
    }

    if (hasChanges) {
        localStorage.setItem(`plugin-settings:${pluginId}`, JSON.stringify(settings));
        settingsStore.set(pluginId, settings);
    }
}

export function useSetting<T extends PluginOptions, K extends keyof T & string>(
    pluginId: string,
    key: K
): [InferOptionType<T[K]>, (value: InferOptionType<T[K]>) => void] {
    const [value, setValue] = React.useState(getPluginSetting(pluginId, key, {} as T));
    React.useEffect(() => {
        const listener = (e: CustomEvent<{ pluginId: string; key: string; value: unknown; }>) => {
            if (e.detail.pluginId === pluginId && e.detail.key === key) {
                setValue(e.detail.value as InferOptionType<T[K]>);
            }
        };
        window.addEventListener("grok-settings-updated", listener as EventListener);
        return () => window.removeEventListener("grok-settings-updated", listener as EventListener);
    }, [pluginId, key]);
    const setter = (newValue: InferOptionType<T[K]>) => setPluginSetting(pluginId, key, newValue);
    return [value, setter];
}

// =============================================================================
// UI PATCH BUILDER
// =============================================================================

function resolveParent(parent: ParentSpec, found: HTMLElement): HTMLElement | null {
    if (!parent) {
        return found.parentElement;
    }
    if (typeof parent === "string" || typeof parent === "object") {
        const result = selectOne(parent as AnySelector, found);
        return result.success && result.data ? result.data : found;
    }
    return parent(found);
}

function resolveReference(
    insert: InsertSpec | undefined,
    parent: HTMLElement,
    found: HTMLElement
): Node | null {
    if (!insert) {
        return null;
    }
    if ("append" in insert && insert.append) {
        return parent.lastChild;
    }
    if ("prepend" in insert && insert.prepend) {
        return parent.firstChild;
    }
    if ("after" in insert) {
        const ref = insert.after;
        if (typeof ref === "string" || typeof ref === "object") {
            const result = selectOne(ref as AnySelector, parent);
            return result.success ? result.data : null;
        }
        return ref(parent, found);
    }
    if ("before" in insert) {
        const ref = insert.before;
        if (typeof ref === "string" || typeof ref === "object") {
            const result = selectOne(ref as AnySelector, parent);
            return result.success ? result.data : null;
        }
        return ref(parent, found);
    }
    return null;
}

export function ui(def: SimpleUIPatch): IPluginUIPatch {
    return {
        component: def.component as React.ComponentType<InjectedComponentProps>,
        target: def.target as unknown as string | ElementFinderConfig,
        forEach: !!def.each,
        getTargetParent: (found: HTMLElement) => resolveParent(def.parent, found),
        referenceNode: (parent: HTMLElement, found: HTMLElement) => {
            const ref = resolveReference(def.insert, parent, found);
            if (!ref) {
                return null;
            }
            return ref;
        },
        predicate: def.predicate,
        observerDebounce: def.observerDebounce,
    };
}

export class UIPatchBuilder {
    private spec: {
        component?: React.ComponentType<InjectedComponentProps>;
        target?: string | ElementFinderConfig;
        forEach?: boolean;
        getTargetParent?: (foundElement: HTMLElement) => HTMLElement | null;
        referenceNode?: (parentElement: HTMLElement, foundElement: HTMLElement) => Node | null;
        observerDebounce?: boolean | number;
        predicate?: (foundElement: HTMLElement) => boolean;
    };

    private constructor(target: string | ElementFinderConfig) {
        this.spec = {
            component: (() => null) as React.ComponentType<InjectedComponentProps>,
            target,
        };
    }

    static target(target: string | ElementFinderConfig): UIPatchBuilder {
        return new UIPatchBuilder(target);
    }

    component(c: React.ComponentType<InjectedComponentProps>): UIPatchBuilder {
        this.spec.component = c;
        return this;
    }

    forEach(): UIPatchBuilder {
        this.spec.forEach = true;
        return this;
    }

    parent(resolver: (found: HTMLElement) => HTMLElement | null): UIPatchBuilder {
        this.spec.getTargetParent = resolver;
        return this;
    }

    after(ref: AnySelector | ((parent: HTMLElement, found: HTMLElement) => Node | null)): UIPatchBuilder {
        this.spec.referenceNode = (parent, found) => {
            if (typeof ref === "function") {
                return (ref as (p: HTMLElement, f: HTMLElement) => Node | null)(parent, found);
            }
            const el = document.querySelector(ref as string) as Node | null;
            return el;
        };
        return this;
    }

    when(predicate: (found: HTMLElement) => boolean): UIPatchBuilder {
        this.spec.predicate = predicate;
        return this;
    }

    debounce(ms: number): UIPatchBuilder {
        this.spec.observerDebounce = ms;
        return this;
    }

    build(): IPluginUIPatch {
        return {
            target: this.spec.target!,
            component: this.spec.component!,
            forEach: this.spec.forEach,
            getTargetParent: this.spec.getTargetParent,
            referenceNode: this.spec.referenceNode,
            observerDebounce: this.spec.observerDebounce,
            predicate: this.spec.predicate,
        };
    }
}

export namespace Patch {
    export function ui(target: string | ElementFinderConfig): UIPatchBuilder {
        return UIPatchBuilder.target(target);
    }

    export function codeReplace(find: string | RegExp, match: RegExp, replace: string | ((substring: string, ...args: unknown[]) => string), opts?: Omit<IPluginCodePatch, "find" | "replacement">): IPluginCodePatch {
        return { find, replacement: { match, replace }, ...opts };
    }
}

// =============================================================================
// PLUGIN REGISTRY
// =============================================================================

export const plugins: IPlugin[] = [];

// =============================================================================
// PLUGIN FACTORY
// =============================================================================

export function definePlugin<Def extends IPluginDefinition>(def: Def): IPlugin {
    const id = toKebabCase(def.name);

    if (def.settings) {
        const options = def.settings.definition;
        initializePluginSettings(id, options);
        type StoreType = { [K in keyof typeof options]: InferOptionType<(typeof options)[K]> };
        (def.settings as { store: Record<string, unknown>; }).store = new Proxy({}, {
            get(_, key: string) {
                return getPluginSetting(id, key, options);
            },
        });
    }

    const toArray = <T,>(v?: T | T[]): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
    const convertToUIPatch = (p: SimpleUIPatch | IPluginUIPatch): IPluginUIPatch => {
        const candidate = p as IPluginUIPatch;
        if (typeof candidate.getTargetParent === "function" || typeof candidate.referenceNode === "function") {
            return candidate;
        }
        return ui(p as SimpleUIPatch);
    };

    const uiPatches = [...toArray(def.ui as IPluginUIPatch | IPluginUIPatch[])].map(convertToUIPatch);
    const normalizedPatches = [...toArray(def.patches as PluginPatch | PluginPatch[])].map(p => {
        if (p && typeof p === "object" && "component" in p) {
            return convertToUIPatch(p as SimpleUIPatch | IPluginUIPatch);
        }
        return p as IPluginCodePatch | IPatch;
    });
    const allPatches: PluginPatch[] = [...normalizedPatches, ...uiPatches];

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
        experimental: !!def.experimental,
        options: def.settings?.definition || def.options || {},
        styles: def.styles,
        patches: allPatches,
        start: ctx => {
            def.onLoad?.(ctx);
            if (def.styles) {
                pluginHelper.applyStyles(id, def.styles);
            }
            plugin.patches?.forEach(patch => {
                if ("component" in patch) {
                    const uiPatch = patch as IPluginUIPatch;
                    if (uiPatch.forEach) {
                        pluginHelper.applyMultiUIPatch(id, uiPatch);
                    } else {
                        pluginHelper.applySingleUIPatch(id, uiPatch);
                    }
                } else if (!("find" in patch && "replacement" in patch)) {
                    patch.apply?.();
                }
            });
            def.start?.(ctx);
        },
        stop: ctx => {
            if (def.styles) {
                pluginHelper.removeStyles(id);
            }
            plugin.patches?.forEach(patch => {
                if ("component" in patch) {
                    patch.disconnect?.();
                    const uiPatch = patch as IPluginUIPatch;
                    if (uiPatch.forEach) {
                        pluginHelper.removeMultiUIPatch(id);
                    } else {
                        pluginHelper.removeSingleUIPatch(id);
                    }
                } else if (!("find" in patch && "replacement" in patch)) {
                    patch.remove?.();
                }
            });
            def.stop?.(ctx);
            def.onUnload?.(ctx);
        },
    };

    plugins.push(plugin);
    return plugin;
}

export default definePlugin;

export type SettingsUpdatedDetail = { pluginId: string; key: string; value: unknown; };

export function onPluginSettingsUpdated(
    pluginId: string,
    handler: (detail: SettingsUpdatedDetail) => void
): () => void {
    const listener = (e: CustomEvent<SettingsUpdatedDetail>) => {
        if (e.detail.pluginId === pluginId) {
            handler(e.detail);
        }
    };
    window.addEventListener("grok-settings-updated", listener as unknown as EventListener);
    return () => window.removeEventListener("grok-settings-updated", listener as unknown as EventListener);
}
