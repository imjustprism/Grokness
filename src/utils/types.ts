/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type IDeveloper } from "@utils/constants";
import { type AnySelector, type ElementFinderConfig, selectOne } from "@utils/dom";
import { PluginHelper } from "@utils/pluginHelper";
import React from "react";

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
    | "slider"
    | "boolean"
    | "select"
    | "custom";

export enum OptionType {
    STRING = "string",
    NUMBER = "number",
    SLIDER = "slider",
    BOOLEAN = "boolean",
    SELECT = "select",
    CUSTOM = "custom",
}

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
    O["type"] extends "number" | "slider" ? number :
    O["type"] extends "string" ? string :
    O["type"] extends "select" ? O["options"] extends readonly { value: infer V; }[] ? V : unknown :
    unknown;

export interface ISettingsManager<T extends PluginOptions = PluginOptions> {
    definition: T;
    store: { [K in keyof T]: InferOptionType<T[K]> };
}

export type InjectedComponentProps = {
    rootElement?: HTMLElement;
};

export interface IPatch {
    apply?(): void;
    remove?(): void;
    disconnect?: () => void;
}

export interface IPluginUIPatch extends IPatch {
    /** React component to render; receives the matched root element */
    component: React.ComponentType<InjectedComponentProps>;
    /** Target to mount under: CSS selector string or strong DOM finder config */
    target: string | ElementFinderConfig;
    /** If true, inject for every match; otherwise only the first match */
    forEach?: boolean;
    /** Resolve the actual parent to mount into based on the found element */
    getTargetParent?: (foundElement: HTMLElement) => HTMLElement | null;
    /** Resolve an insertion reference node to mount after, if provided */
    referenceNode?: (parentElement: HTMLElement, foundElement: HTMLElement) => Node | null;
    /** Debounce observation callbacks; false disables debounce */
    observerDebounce?: boolean | number;
    /** Optional predicate filter for target elements */
    predicate?: (foundElement: HTMLElement) => boolean;
}

export interface IPluginCodePatch {
    find: string | RegExp;
    replacement: {
        match: RegExp;
        replace: string | ((substring: string, ...args: unknown[]) => string);
    };
    predicate?: () => boolean;
}

export interface IPluginContext {
    readonly storageKey: string;
}

export interface IPluginDefinition {
    id?: string;
    name: string;
    description: string;
    authors: IDeveloper[];
    category?: PluginCategory | string;
    tags?: string[];
    styles?: string;
    dependencies?: string[];
    visible?: boolean;
    enabledByDefault?: boolean;
    requiresRestart?: boolean;
    required?: boolean;
    hidden?: boolean;
    options?: PluginOptions;
    settings?: ISettingsManager;
    patches?: (IPatch | IPluginUIPatch | IPluginCodePatch | SimpleUIPatch)[];
    ui?: SimpleUIPatch | SimpleUIPatch[] | IPluginUIPatch | IPluginUIPatch[];
    start?(context: IPluginContext): void;
    stop?(context: IPluginContext): void;
    onLoad?(context: IPluginContext): void;
    onUnload?(context: IPluginContext): void;
}

export interface IPlugin {
    id: string;
    name: string;
    description: string;
    authors: IDeveloper[];
    category: PluginCategory | string;
    tags: string[];
    styles?: string;
    dependencies: string[];
    visible: boolean;
    enabledByDefault: boolean;
    requiresRestart: boolean;
    required: boolean;
    hidden: boolean;
    options: PluginOptions;
    patches: (IPatch | IPluginUIPatch | IPluginCodePatch)[];
    start(context: IPluginContext): void;
    stop(context: IPluginContext): void;
}

export const plugins: IPlugin[] = [];

const pluginHelper = new PluginHelper();

function toKebabCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
}

const settingsStore = new Map<string, Record<string, unknown>>();

export function definePluginSettings<T extends PluginOptions>(definition: T): ISettingsManager<T> {
    return {
        definition,
        store: {} as { [K in keyof T]: InferOptionType<T[K]> },
    };
}

type ParentSpec = AnySelector | ((foundElement: HTMLElement) => HTMLElement | null) | undefined;

type InsertSpec =
    | { append: true; }
    | { after: AnySelector | ((parent: HTMLElement, found: HTMLElement) => Node | null); };

export type SimpleUIPatch = {
    target: AnySelector;
    component: React.ComponentType<{ rootElement?: HTMLElement; }> | (() => React.ReactElement | null);
    each?: boolean;
    parent?: ParentSpec;
    insert?: InsertSpec;
    predicate?: (el: HTMLElement) => boolean;
    observerDebounce?: boolean | number;
};

function resolveParent(parent: ParentSpec, found: HTMLElement): HTMLElement | null {
    if (!parent) {
        return found.parentElement;
    }
    if (typeof parent === "string" || typeof parent === "object") {
        return selectOne(parent as AnySelector, found) ?? found;
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
    if ("after" in insert) {
        const ref = insert.after;
        if (typeof ref === "string" || typeof ref === "object") {
            const el = selectOne(ref as AnySelector, parent);
            return el ?? null;
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
    } as IPluginUIPatch;
}

export default definePlugin;

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
        window.addEventListener("grok-settings-updated", listener as unknown as EventListener);
        return () => window.removeEventListener("grok-settings-updated", listener as unknown as EventListener);
    }, [pluginId, key]);
    const setter = (newValue: InferOptionType<T[K]>) => setPluginSetting(pluginId, key, newValue);
    return [value, setter];
}

export function definePlugin<Def extends IPluginDefinition>(def: Def): IPlugin {
    const id = def.id || toKebabCase(def.name);

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

    const toArray = <T,>(v?: T | T[]): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
    const convertToUIPatch = (p: SimpleUIPatch | IPluginUIPatch): IPluginUIPatch => {
        const candidate = p as IPluginUIPatch;
        if (typeof candidate.getTargetParent === "function" || typeof candidate.referenceNode === "function") {
            return candidate;
        }
        return ui(p as SimpleUIPatch);
    };

    const uiPatches = toArray(def.ui).map(convertToUIPatch);
    const normalizedPatches = toArray(def.patches).map(p => {
        if (p && typeof (p as any) === "object" && (p as any).component) {
            return convertToUIPatch(p as unknown as SimpleUIPatch | IPluginUIPatch);
        }
        return p as IPluginCodePatch | IPatch;
    });
    const allPatches = [...normalizedPatches, ...uiPatches];

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
