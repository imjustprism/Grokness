/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type AnySelector, selectOne } from "@utils/dom";
import { definePlugin, type IPluginDefinition, type IPluginUIPatch } from "@utils/types";
import type React from "react";

type ParentSpec =
    | AnySelector
    | ((foundElement: HTMLElement) => HTMLElement | null)
    | undefined;

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
        component: def.component as React.ComponentType<{ rootElement?: HTMLElement; }>,
        target: def.target,
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

export function defineUIPlugin(def: Omit<IPluginDefinition, "patches"> & { ui: SimpleUIPatch | SimpleUIPatch[]; }): ReturnType<typeof definePlugin> {
    const patches: IPluginUIPatch[] = Array.isArray(def.ui) ? def.ui.map(ui) : [ui(def.ui)];
    return definePlugin({ ...def, patches });
}
