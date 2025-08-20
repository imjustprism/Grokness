/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ErrorBoundary } from "@components/ErrorBoundary";
import { type AnySelector, selectAll } from "@utils/dom";
import { Logger } from "@utils/logger";
import { type InjectedComponentProps, type IPluginUIPatch } from "@utils/types";
import React from "react";
import { createRoot, type Root } from "react-dom/client";

type UIMount = {
    readonly container: HTMLElement;
    readonly root: Root;
    readonly target: HTMLElement;
    readonly pluginId: string;
    readonly patchId: string;
};

type ActiveUIMountCollection = {
    readonly observer: MutationObserver;
    readonly mounts: Map<HTMLElement, UIMount>;
    readonly patch: IPluginUIPatch;
    readonly pluginId: string;
};

export class PluginHelper {
    private readonly logger = new Logger("PluginHelper", "#f28cb1");
    private readonly styleIds = new Set<string>();
    private readonly styleObjectUrls = new Map<string, string>();
    private readonly adoptedSheets = new Map<string, CSSStyleSheet>();
    private readonly activeUIPatchesByPlugin = new Map<string, Set<ActiveUIMountCollection>>();
    private readonly styleCache = new Map<string, CSSStyleSheet | string>();
    private readonly mountRegistry = new Map<string, UIMount>();

    applyStyles(pluginId: string, css: string): void {
        if (!css?.trim()) {
            this.logger.warn(`Plugin ${pluginId} provided empty styles`);
            return;
        }

        const cacheKey = this.createCacheKey(css);
        const id = `grokness-style-${pluginId}`;

        this.removeStyles(pluginId);

        const cached = this.styleCache.get(cacheKey);
        if (cached instanceof CSSStyleSheet) {
            this.applyConstructableStylesheet(id, pluginId, cached);
            return;
        } else if (typeof cached === "string") {
            this.applyBlobStylesheet(id, pluginId, cached);
            return;
        }

        if (this.supportsConstructableStylesheets()) {
            try {
                const sheet = new CSSStyleSheet();
                sheet.replaceSync(css);
                this.styleCache.set(cacheKey, sheet);
                this.applyConstructableStylesheet(id, pluginId, sheet);
                return;
            } catch (error) {
                this.logger.warn(`Failed to create constructable stylesheet for ${pluginId}:`, error);
            }
        }

        try {
            const blob = new Blob([css], { type: "text/css" });
            const href = URL.createObjectURL(blob);
            this.styleCache.set(cacheKey, href);
            this.applyBlobStylesheet(id, pluginId, href);
        } catch (error) {
            this.logger.warn(`Failed to create blob stylesheet for ${pluginId}:`, error);
            this.applyInlineStylesheet(id, pluginId, css);
        }
    }

    private createCacheKey(css: string): string {
        let hash = 0;
        for (let i = 0; i < css.length; i++) {
            const char = css.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash &= hash; // Convert to 32-bit integer
        }
        return `css_${hash}`;
    }

    private supportsConstructableStylesheets(): boolean {
        return typeof (window as unknown as { CSSStyleSheet?: unknown; }).CSSStyleSheet !== "undefined"
            && Array.isArray((document as unknown as { adoptedStyleSheets?: unknown; }).adoptedStyleSheets);
    }

    private applyConstructableStylesheet(id: string, pluginId: string, sheet: CSSStyleSheet): void {
        try {
            const current = (document as unknown as { adoptedStyleSheets: CSSStyleSheet[]; }).adoptedStyleSheets;
            (document as unknown as { adoptedStyleSheets: CSSStyleSheet[]; }).adoptedStyleSheets = [...current, sheet];
            this.adoptedSheets.set(pluginId, sheet);
            this.styleIds.add(id);
            this.logger.debug(`Applied constructable stylesheet for ${pluginId}`);
        } catch (error) {
            this.logger.error(`Failed to apply constructable stylesheet for ${pluginId}:`, error);
            throw error;
        }
    }

    private applyBlobStylesheet(id: string, pluginId: string, href: string): void {
        try {
            const link = document.createElement("link");
            link.id = id;
            link.rel = "stylesheet";
            link.href = href;
            document.head.appendChild(link);
            this.styleObjectUrls.set(pluginId, href);
            this.styleIds.add(id);
            this.logger.debug(`Applied blob stylesheet for ${pluginId}`);
        } catch (error) {
            this.logger.error(`Failed to apply blob stylesheet for ${pluginId}:`, error);
            throw error;
        }
    }

    private applyInlineStylesheet(id: string, pluginId: string, css: string): void {
        try {
            const tag = document.createElement("style");
            tag.id = id;
            tag.textContent = css;
            document.head.appendChild(tag);
            this.styleIds.add(id);
            this.logger.debug(`Applied inline stylesheet for ${pluginId}`);
        } catch (error) {
            this.logger.error(`Failed to apply inline stylesheet for ${pluginId}:`, error);
            throw error;
        }
    }

    removeStyles(pluginId: string): void {
        const id = `grokness-style-${pluginId}`;

        const tag = document.getElementById(id);
        if (tag) {
            tag.remove();
            this.styleIds.delete(id);
        }

        const prevUrl = this.styleObjectUrls.get(pluginId);
        if (prevUrl) {
            try {
                URL.revokeObjectURL(prevUrl);
                this.logger.debug(`Revoked blob URL for ${pluginId}`);
            } catch (error) {
                this.logger.warn(`Failed to revoke blob URL for ${pluginId}:`, error);
            } finally {
                this.styleObjectUrls.delete(pluginId);
            }
        }

        const prevSheet = this.adoptedSheets.get(pluginId);
        if (prevSheet && this.supportsConstructableStylesheets()) {
            try {
                const sheets = (document as unknown as { adoptedStyleSheets: CSSStyleSheet[]; }).adoptedStyleSheets;
                (document as unknown as { adoptedStyleSheets: CSSStyleSheet[]; }).adoptedStyleSheets = sheets.filter(s => s !== prevSheet);
                this.logger.debug(`Removed constructable stylesheet for ${pluginId}`);
            } catch (error) {
                this.logger.error(`Failed to remove constructable stylesheet for ${pluginId}:`, error);
            } finally {
                this.adoptedSheets.delete(pluginId);
            }
        }
    }

    applyUIPatch(pluginId: string, patch: IPluginUIPatch): void {
        try {
            this.validatePatch(patch);

            document.querySelectorAll(`[data-grokness-ui="${pluginId}"]`).forEach(el => el.remove());

            const mounts = new Map<HTMLElement, UIMount>();
            const mountKey = this.generateMountKey(patch);

            const scan = (): void => {
                try {
                    const targets = this.findTargets(patch);
                    this.cleanupDeadMounts(mounts);
                    this.mountComponents(pluginId, patch, targets, mounts, mountKey);
                } catch (error) {
                    this.logger.error(`Error during UI patch scan for ${pluginId}:`, error);
                }
            };

            const observer = this.createObserver(patch, scan);
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: false,
            });

            scan();

            const entry: ActiveUIMountCollection = { observer, mounts, patch, pluginId };
            const set = this.activeUIPatchesByPlugin.get(pluginId) ?? new Set<ActiveUIMountCollection>();
            set.add(entry);
            this.activeUIPatchesByPlugin.set(pluginId, set);

            this.logger.debug(`Applied UI patch for ${pluginId} with ${mounts.size} mounts`);
        } catch (error) {
            this.logger.error(`Failed to apply UI patch for ${pluginId}:`, error);
            throw error;
        }
    }

    private validatePatch(patch: IPluginUIPatch): void {
        if (!patch.component) {
            throw new Error("UI patch must have a component");
        }
        if (!patch.target) {
            throw new Error("UI patch must have a target");
        }
    }

    private generateMountKey(patch: IPluginUIPatch): string {
        const componentName = this.getComponentName(patch.component);
        const targetKey = typeof patch.target === "string"
            ? patch.target
            : (patch.target && (patch.target as { selector?: string; }).selector) || "custom";
        return this.hashKey(`${componentName}::${targetKey}`);
    }

    private getComponentName(component: React.ComponentType): string {
        const comp = component as unknown as { displayName?: string; name?: string; };
        return comp.displayName || comp.name || "Component";
    }

    private hashKey(input: string): string {
        let hash = 2166136261 >>> 0; // FNV-1a 32-bit
        for (let i = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash = Math.imul(hash, 16777619) >>> 0;
        }
        return `k${hash.toString(36)}`;
    }

    private cleanupDeadMounts(mounts: Map<HTMLElement, UIMount>): void {
        for (const [target, mount] of mounts) {
            if (!document.contains(target)) {
                try {
                    mount.root.unmount();
                    mount.container.remove();
                    this.mountRegistry.delete(`${mount.pluginId}:${mount.patchId}`);
                } catch (error) {
                    this.logger.warn("Error cleaning up mount:", error);
                }
                mounts.delete(target);
            }
        }
    }

    private mountComponents(
        pluginId: string,
        patch: IPluginUIPatch,
        targets: HTMLElement[],
        mounts: Map<HTMLElement, UIMount>,
        mountKey: string
    ): void {
        for (const target of targets) {
            if (patch.predicate && !patch.predicate(target)) {
                continue;
            }

            if (mounts.has(target) && document.contains(mounts.get(target)!.container)) {
                continue;
            }

            try {
                this.createMount(pluginId, patch, target, mounts, mountKey);
            } catch (error) {
                this.logger.error("Failed to mount component for target:", target, error);
            }
        }
    }

    private createMount(
        pluginId: string,
        patch: IPluginUIPatch,
        target: HTMLElement,
        mounts: Map<HTMLElement, UIMount>,
        mountKey: string
    ): void {
        const parent = patch.getTargetParent ? patch.getTargetParent(target) : target.parentElement;
        if (!parent) {
            return;
        }

        let container = parent.querySelector<HTMLElement>(
            `[data-grokness-ui="${pluginId}"][data-grokness-ui-key="${mountKey}"]`
        );

        const refNode = patch.referenceNode?.(parent, target) ?? null;

        if (!container) {
            container = this.createContainer(pluginId, mountKey, parent, refNode);
        } else {
            container = this.replaceContainer(container, parent, refNode);
        }

        const root = createRoot(container);
        const Component = patch.component as React.ComponentType<InjectedComponentProps>;

        root.render(
            React.createElement(
                ErrorBoundary as unknown as React.ComponentType<{ pluginId: string; children?: React.ReactNode; }>,
                { pluginId },
                React.createElement(Component, { rootElement: target })
            )
        );

        const mount: UIMount = {
            container,
            root,
            target,
            pluginId,
            patchId: mountKey,
        };

        mounts.set(target, mount);
        this.mountRegistry.set(`${pluginId}:${mountKey}`, mount);
    }

    private createContainer(pluginId: string, mountKey: string, parent: HTMLElement, refNode: Node | null): HTMLElement {
        const container = document.createElement("div");
        container.setAttribute("data-grokness-ui", pluginId);
        container.setAttribute("data-grokness-ui-key", mountKey);

        if (refNode && refNode.parentNode === parent) {
            parent.insertBefore(container, refNode.nextSibling);
        } else {
            parent.appendChild(container);
        }

        return container;
    }

    private replaceContainer(container: HTMLElement, parent: HTMLElement, refNode: Node | null): HTMLElement {
        const replacement = container.cloneNode(false) as HTMLElement;
        if (refNode && refNode.parentNode === parent) {
            parent.insertBefore(replacement, refNode.nextSibling);
        } else {
            parent.insertBefore(replacement, container.nextSibling);
        }
        container.remove();
        return replacement;
    }

    private createObserver(patch: IPluginUIPatch, scan: () => void): MutationObserver {
        let debounceTimer: number | null = null;

        return new MutationObserver(() => {
            if (typeof patch.observerDebounce === "number" && patch.observerDebounce > 0) {
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
                debounceTimer = window.setTimeout(() => {
                    debounceTimer = null;
                    scan();
                }, patch.observerDebounce);
            } else {
                scan();
            }
        });
    }

    removeUIPatch(pluginId: string): void {
        this.removeAllUIPatches(pluginId);
    }

    removeAllUIPatches(pluginId: string): void {
        const set = this.activeUIPatchesByPlugin.get(pluginId);
        if (!set) {
            return;
        }

        let cleanedCount = 0;
        for (const active of set) {
            try {
                this.cleanupObserver(active.observer);
                cleanedCount += this.cleanupMounts(active.mounts);
            } catch (error) {
                this.logger.error(`Error cleaning up UI patch for ${pluginId}:`, error);
            }
        }

        this.activeUIPatchesByPlugin.delete(pluginId);
        this.logger.debug(`Cleaned up ${cleanedCount} mounts for plugin ${pluginId}`);
    }

    private cleanupObserver(observer: MutationObserver): void {
        const self = observer as unknown as { __t?: number | null; };
        if (self.__t) {
            clearTimeout(self.__t);
            self.__t = null;
        }
        observer.disconnect();
    }

    private cleanupMounts(mounts: Map<HTMLElement, UIMount>): number {
        let cleanedCount = 0;
        for (const { root, container, pluginId, patchId } of mounts.values()) {
            try {
                root.unmount();
                container.remove();
                this.mountRegistry.delete(`${pluginId}:${patchId}`);
                cleanedCount++;
            } catch (error) {
                this.logger.warn("Error cleaning up mount:", error);
            }
        }
        return cleanedCount;
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
        try {
            const result = selectAll<HTMLElement>(patch.target as unknown as AnySelector);
            if (!result.success) {
                this.logger.warn("Failed to find targets:", result.error);
                return [];
            }
            return patch.forEach ? result.data : (result.data.length ? [result.data[0]!] : []);
        } catch (error) {
            this.logger.error("Error finding targets for patch:", error);
            return [];
        }
    }

    /**
     * Get statistics about the current state of the plugin helper
     */
    getStats(): {
        activePlugins: number;
        totalMounts: number;
        cachedStyles: number;
        styleIds: number;
    } {
        const totalMounts = Array.from(this.activeUIPatchesByPlugin.values())
            .reduce((sum, set) => sum + Array.from(set).reduce((s, active) => s + active.mounts.size, 0), 0);

        return {
            activePlugins: this.activeUIPatchesByPlugin.size,
            totalMounts,
            cachedStyles: this.styleCache.size,
            styleIds: this.styleIds.size,
        };
    }

    /**
     * Clear all caches and perform cleanup
     */
    clearCaches(): void {
        for (const [key, value] of this.styleCache) {
            if (typeof value === "string") {
                try {
                    URL.revokeObjectURL(value);
                } catch (error) {
                    this.logger.warn(`Failed to revoke URL for cache key ${key}:`, error);
                }
            }
        }
        this.styleCache.clear();

        this.mountRegistry.clear();

        this.logger.debug("Cleared all caches");
    }

    /**
     * Get information about a specific plugin's mounts
     */
    getPluginMounts(pluginId: string): UIMount[] {
        const set = this.activeUIPatchesByPlugin.get(pluginId);
        if (!set) {
            return [];
        }

        const mounts: UIMount[] = [];
        for (const active of set) {
            mounts.push(...active.mounts.values());
        }
        return mounts;
    }
}
