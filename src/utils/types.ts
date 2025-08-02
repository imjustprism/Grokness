/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type IDeveloper } from "@utils/constants";
import { type ElementFinderConfig } from "@utils/dom";
import { PluginHelper } from "@utils/pluginHelper";
import { getPluginSetting, initializePluginSettings } from "@utils/settings";
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
    unknown;

export interface InjectedComponentProps {
    rootElement?: HTMLElement;
}

export interface IPatch {
    apply?(): void;
    remove?(): void;
    disconnect?: () => void;
}

export interface IPluginUIPatch extends IPatch {
    component: React.ComponentType<InjectedComponentProps>;
    target: string | ElementFinderConfig;
    forEach?: boolean;
    getTargetParent?: (foundElement: HTMLElement) => HTMLElement | null;
    referenceNode?: (parentElement: HTMLElement, foundElement: HTMLElement) => Node | null;
    observerDebounce?: boolean | number;
}

export interface IPluginCodePatch {
    find: string | RegExp;
    replacement: {
        match: RegExp;
        replace: string | ((substring: string, ...args: any[]) => string);
    };
    predicate?: () => boolean;
}

export interface ISettingsManager<T extends PluginOptions = PluginOptions> {
    definition: T;
    store: { [K in keyof T]: InferOptionType<T[K]> };
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
    patches?: (IPatch | IPluginUIPatch | IPluginCodePatch)[];
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
        patches: def.patches || [],
        start: ctx => {
            def.onLoad?.(ctx);
            if (def.styles) {
                pluginHelper.applyStyles(id, def.styles);
            }
            def.patches?.forEach(patch => {
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
            def.patches?.forEach(patch => {
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
