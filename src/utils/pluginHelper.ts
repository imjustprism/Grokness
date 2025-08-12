/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ErrorBoundary } from "@components/ErrorBoundary";
import { type AnySelector, selectAll } from "@utils/dom";
import { type InjectedComponentProps, type IPluginUIPatch } from "@utils/types";
import React from "react";
import { createRoot, type Root } from "react-dom/client";

type UIMount = {
    container: HTMLElement;
    root: Root;
    target: HTMLElement;
};

type ActiveUIMountCollection = {
    observer: MutationObserver;
    mounts: Map<HTMLElement, UIMount>;
    patch: IPluginUIPatch;
};

export class PluginHelper {
    private readonly styleIds = new Set<string>();
    private readonly activeUIPatchesByPlugin = new Map<string, Set<ActiveUIMountCollection>>();

    applyStyles(pluginId: string, css: string): void {
        const id = `grokness-style-${pluginId}`;
        if (this.styleIds.has(id)) {
            return;
        }
        const tag = document.createElement("style");
        tag.id = id;
        tag.textContent = css;
        document.head.appendChild(tag);
        this.styleIds.add(id);
    }

    removeStyles(pluginId: string): void {
        const id = `grokness-style-${pluginId}`;
        const tag = document.getElementById(id);
        if (tag) {
            tag.remove();
            this.styleIds.delete(id);
        }
    }

    applyUIPatch(pluginId: string, patch: IPluginUIPatch): void {
        const mounts = new Map<HTMLElement, UIMount>();

        const computeMountKey = (): string => {
            const componentName = (patch.component as unknown as { displayName?: string; name?: string; }).displayName
                || (patch.component as unknown as { name?: string; }).name
                || "Component";
            const targetKey = typeof patch.target === "string"
                ? patch.target
                : (patch.target && (patch.target as { selector?: string; }).selector) || "custom";
            return `${componentName}::${targetKey}`;
        };

        const hashKey = (input: string): string => {
            let hash = 2166136261 >>> 0; // FNV-1a 32-bit
            for (let i = 0; i < input.length; i++) {
                hash ^= input.charCodeAt(i);
                hash = Math.imul(hash, 16777619) >>> 0;
            }
            return `k${hash.toString(36)}`;
        };

        const mountKey = hashKey(computeMountKey());

        const scan = (): void => {
            const targets = this.findTargets(patch);

            for (const [t, m] of mounts) {
                if (!document.contains(t)) {
                    m.root.unmount();
                    m.container.remove();
                    mounts.delete(t);
                }
            }

            for (const t of targets) {
                if (patch.predicate && !patch.predicate(t)) {
                    continue;
                }
                if (mounts.has(t) && document.contains(mounts.get(t)!.container)) {
                    continue;
                }

                const parent = patch.getTargetParent ? patch.getTargetParent(t) : t.parentElement;
                if (!parent) {
                    continue;
                }

                let container = parent.querySelector<HTMLElement>(
                    `[data-grokness-ui="${pluginId}"][data-grokness-ui-key="${mountKey}"]`
                );

                const refNode = patch.referenceNode?.(parent, t) ?? null;

                if (!container) {
                    container = document.createElement("div");
                    container.setAttribute("data-grokness-ui", pluginId);
                    container.setAttribute("data-grokness-ui-key", mountKey);
                    if (refNode && refNode.parentNode === parent) {
                        parent.insertBefore(container, refNode.nextSibling);
                    } else {
                        parent.appendChild(container);
                    }
                } else {
                    const replacement = container.cloneNode(false) as HTMLElement;
                    if (refNode && refNode.parentNode === parent) {
                        parent.insertBefore(replacement, refNode.nextSibling);
                    } else {
                        parent.insertBefore(replacement, container.nextSibling);
                    }
                    container.remove();
                    container = replacement;
                }

                const root = createRoot(container);
                const Component = patch.component as React.ComponentType<InjectedComponentProps>;

                root.render(
                    React.createElement(
                        ErrorBoundary as unknown as React.ComponentType<{ pluginId: string; children?: React.ReactNode; }>,
                        { pluginId },
                        React.createElement(Component, { rootElement: t })
                    )
                );

                mounts.set(t, { container, root, target: t });
            }
        };

        const observer = new MutationObserver(() => {
            if (typeof patch.observerDebounce === "number" && patch.observerDebounce > 0) {
                const self = observer as unknown as { __t?: number | null; };
                if (self.__t) {
                    clearTimeout(self.__t);
                }
                self.__t = window.setTimeout(() => {
                    self.__t = null;
                    scan();
                }, patch.observerDebounce);
            } else {
                scan();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: false,
        });

        scan();

        const entry: ActiveUIMountCollection = { observer, mounts, patch };
        const set = this.activeUIPatchesByPlugin.get(pluginId) ?? new Set<ActiveUIMountCollection>();
        set.add(entry);
        this.activeUIPatchesByPlugin.set(pluginId, set);
    }

    removeUIPatch(pluginId: string): void {
        this.removeAllUIPatches(pluginId);
    }

    removeAllUIPatches(pluginId: string): void {
        const set = this.activeUIPatchesByPlugin.get(pluginId);
        if (!set) {
            return;
        }
        for (const active of set) {
            const self = active.observer as unknown as { __t?: number | null; };
            if (self.__t) {
                clearTimeout(self.__t);
                self.__t = null;
            }
            active.observer.disconnect();
            for (const { root, container } of active.mounts.values()) {
                root.unmount();
                container.remove();
            }
        }
        this.activeUIPatchesByPlugin.delete(pluginId);
    }

    applyMultiUIPatch(pluginId: string, patch: IPluginUIPatch): void {
        this.applyUIPatch(pluginId, { ...patch, forEach: true });
    }
    applySingleUIPatch(pluginId: string, patch: IPluginUIPatch): void {
        this.applyUIPatch(pluginId, { ...patch, forEach: false });
    }
    removeMultiUIPatch(pluginId: string): void {
        this.removeAllUIPatches(pluginId);
    }
    removeSingleUIPatch(pluginId: string): void {
        this.removeAllUIPatches(pluginId);
    }

    private findTargets(patch: IPluginUIPatch): HTMLElement[] {
        const all = selectAll<HTMLElement>(patch.target as unknown as AnySelector);
        return patch.forEach ? all : (all.length ? [all[0]!] : []);
    }
}
