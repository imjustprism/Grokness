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

type Mount = {
    container: HTMLElement;
    root: Root;
    target: HTMLElement;
};

type ActiveUIPatch = {
    observer: MutationObserver;
    mounts: Map<HTMLElement, Mount>;
    patch: IPluginUIPatch;
};

export class PluginHelper {
    private styleIds = new Set<string>();
    private activeUIPatches = new Map<string, ActiveUIPatch>();

    applyStyles(pluginId: string, css: string) {
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

    removeStyles(pluginId: string) {
        const id = `grokness-style-${pluginId}`;
        const tag = document.getElementById(id);
        if (tag) {
            tag.remove();
            this.styleIds.delete(id);
        }
    }

    applyUIPatch(pluginId: string, patch: IPluginUIPatch) {
        this.removeUIPatch(pluginId);

        const mounts = new Map<HTMLElement, Mount>();

        const scan = () => {
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

                const container = document.createElement("div");
                container.setAttribute("data-grokness-ui", pluginId);

                const refNode = patch.referenceNode?.(parent, t) ?? null;
                if (refNode && refNode.parentNode === parent) {
                    parent.insertBefore(container, refNode.nextSibling);
                } else {
                    parent.appendChild(container);
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
                if ((observer as unknown as { __t?: number | null; }).__t) {
                    clearTimeout((observer as unknown as { __t?: number | null; }).__t!);
                }
                (observer as unknown as { __t?: number | null; }).__t = window.setTimeout(() => {
                    (observer as unknown as { __t?: number | null; }).__t = null;
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

        this.activeUIPatches.set(pluginId, { observer, mounts, patch });
    }

    removeUIPatch(pluginId: string) {
        const active = this.activeUIPatches.get(pluginId);
        if (!active) {
            return;
        }
        active.observer.disconnect();
        for (const { root, container } of active.mounts.values()) {
            root.unmount();
            container.remove();
        }
        this.activeUIPatches.delete(pluginId);
    }

    applyMultiUIPatch(pluginId: string, patch: IPluginUIPatch) {
        this.applyUIPatch(pluginId, { ...patch, forEach: true });
    }
    applySingleUIPatch(pluginId: string, patch: IPluginUIPatch) {
        this.applyUIPatch(pluginId, { ...patch, forEach: false });
    }
    removeMultiUIPatch(pluginId: string) {
        this.removeUIPatch(pluginId);
    }
    removeSingleUIPatch(pluginId: string) {
        this.removeUIPatch(pluginId);
    }

    private findTargets(patch: IPluginUIPatch): HTMLElement[] {
        const all = selectAll<HTMLElement>(patch.target as unknown as AnySelector);
        return patch.forEach ? all : (all.length ? [all[0]!] : []);
    }
}
