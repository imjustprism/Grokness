/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ErrorBoundary } from "@components/ErrorBoundary";
import { type ElementFinderConfig, findElement, MutationObserverManager, querySelectorAll } from "@utils/dom";
import { Logger } from "@utils/logger";
import { type IPluginUIPatch } from "@utils/types";
import React from "react";
import { createRoot, type Root } from "react-dom/client";

const helperLogger = new Logger("PluginHelper", "#89b4fa");

export class PluginHelper {
    private observerManager = new MutationObserverManager();
    private styleElements = new Map<string, HTMLStyleElement>();
    private singleRoots = new Map<string, Root>();
    private singleContainers = new Map<string, HTMLElement>();
    private multiRootMaps = new Map<string, Map<HTMLElement, Root>>();
    private multiElementMaps = new Map<string, Map<HTMLElement, HTMLElement>>();
    private activeUIPatches = new Set<string>();

    /**
     * Cleans up the DOM elements for a single UI patch without deactivating it.
     * This is used for temporary removals, allowing re-injection later.
     */
    private cleanupSingleUIPatch(pluginId: string): void {
        try {
            this.singleRoots.get(pluginId)?.unmount();
            this.singleContainers.get(pluginId)?.remove();
            this.singleRoots.delete(pluginId);
            this.singleContainers.delete(pluginId);
        } catch (error) {
            helperLogger.error(`[${pluginId}] Error cleaning up single UI patch:`, error);
        }
    }

    public applySingleUIPatch(pluginId: string, patch: IPluginUIPatch): void {
        this.activeUIPatches.add(pluginId);

        try {
            const targetFinder: ElementFinderConfig = typeof patch.target === "string" ? { selector: patch.target } : patch.target;

            const handleInjection = (rootElement: HTMLElement) => {
                if (!this.activeUIPatches.has(pluginId) || this.singleContainers.has(pluginId)) {
                    return;
                }

                const container = document.createElement("div");
                container.id = `${pluginId}-container`;
                this.singleContainers.set(pluginId, container);

                const targetParent = patch.getTargetParent?.(rootElement) ?? rootElement;
                const referenceNode = patch.referenceNode?.(targetParent, rootElement);
                targetParent.insertBefore(container, referenceNode ?? null);

                const root = createRoot(container);
                root.render(
                    React.createElement(
                        ErrorBoundary, {
                        pluginId,
                        children: React.createElement(patch.component, { rootElement })
                    }
                    )
                );
                this.singleRoots.set(pluginId, root);
            };

            const observerCallback = () => {
                const element = findElement(targetFinder);
                if (element && !this.singleContainers.has(pluginId)) {
                    handleInjection(element);
                } else if (!element && this.singleContainers.has(pluginId)) {
                    this.cleanupSingleUIPatch(pluginId);
                }
            };

            const useDebounce = patch.observerDebounce !== false;
            const debounceDelay = typeof patch.observerDebounce === "number" ? patch.observerDebounce : undefined;
            const observerCreator = useDebounce ? this.observerManager.createDebouncedObserver : this.observerManager.createObserver;

            const { observe, disconnect } = observerCreator({
                target: document.body,
                options: { childList: true, subtree: true },
                callback: observerCallback,
                debounceDelay,
            });

            patch.disconnect = () => disconnect();

            const initialElement = findElement(targetFinder);
            if (initialElement) {
                handleInjection(initialElement);
            }

            observe();
        } catch (error) {
            helperLogger.error(`[${pluginId}] Error applying single UI patch:`, error);
        }
    }

    public applyMultiUIPatch(pluginId: string, patch: IPluginUIPatch): void {
        this.activeUIPatches.add(pluginId);

        try {
            const targetSelector = typeof patch.target === "string" ? patch.target : patch.target.selector;
            const instanceRoots = new Map<HTMLElement, Root>();
            const elementToContainer = new Map<HTMLElement, HTMLElement>();
            const processedElements = new Set<HTMLElement>();
            this.multiRootMaps.set(pluginId, instanceRoots);
            this.multiElementMaps.set(pluginId, elementToContainer);

            const injectIntoElement = (element: HTMLElement) => {
                if (!this.activeUIPatches.has(pluginId) || processedElements.has(element)) {
                    return;
                }

                processedElements.add(element);
                const container = document.createElement("div");
                container.id = `${pluginId}-${Math.random().toString(36).substring(2, 9)}`;
                const targetParent = patch.getTargetParent?.(element) ?? element;
                const referenceNode = patch.referenceNode?.(targetParent, element);
                if (!targetParent) {
                    return;
                }
                targetParent.insertBefore(container, referenceNode ?? null);
                const root = createRoot(container);
                root.render(
                    React.createElement(
                        ErrorBoundary, {
                        pluginId,
                        children: React.createElement(patch.component, { rootElement: element })
                    }
                    )
                );
                instanceRoots.set(container, root);
                elementToContainer.set(element, container);
            };

            const removeFromElement = (element: HTMLElement) => {
                const container = elementToContainer.get(element);
                if (container) {
                    const root = instanceRoots.get(container);
                    root?.unmount();
                    container.remove();
                    instanceRoots.delete(container);
                    elementToContainer.delete(element);
                    processedElements.delete(element);
                }
            };

            querySelectorAll(targetSelector).forEach(el => injectIntoElement(el as HTMLElement));

            const observerCallback = (mutations: MutationRecord[]) => {
                if (!this.activeUIPatches.has(pluginId)) {
                    return;
                }

                for (const mutation of mutations) {
                    if (mutation.type === "childList") {
                        mutation.addedNodes.forEach(node => {
                            if (node instanceof HTMLElement) {
                                if (node.matches(targetSelector)) {
                                    injectIntoElement(node);
                                }
                                node.querySelectorAll(targetSelector).forEach(el => injectIntoElement(el as HTMLElement));
                            }
                        });
                        mutation.removedNodes.forEach(node => {
                            if (node instanceof HTMLElement && processedElements.has(node)) {
                                removeFromElement(node);
                            }
                        });
                    } else if (mutation.type === "attributes" && mutation.target instanceof HTMLElement) {
                        const nowMatches = mutation.target.matches(targetSelector);
                        const wasProcessed = processedElements.has(mutation.target);
                        if (nowMatches && !wasProcessed) {
                            injectIntoElement(mutation.target);
                        } else if (!nowMatches && wasProcessed) {
                            removeFromElement(mutation.target);
                        }
                    }
                }
            };

            const { observe, disconnect } = this.observerManager.createObserver({
                target: document.body,
                options: { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] },
                callback: observerCallback
            });

            patch.disconnect = () => disconnect();
            observe();
        } catch (error) {
            helperLogger.error(`[${pluginId}] Error applying multi UI patch:`, error);
        }
    }

    public removeSingleUIPatch(pluginId: string): void {
        this.activeUIPatches.delete(pluginId);
        this.cleanupSingleUIPatch(pluginId);
    }

    public removeMultiUIPatch(pluginId: string): void {
        this.activeUIPatches.delete(pluginId);
        try {
            const instanceRoots = this.multiRootMaps.get(pluginId);
            if (instanceRoots) {
                instanceRoots.forEach((root, container) => {
                    root.unmount();
                    container.remove();
                });
            }
            this.multiRootMaps.delete(pluginId);
            this.multiElementMaps.delete(pluginId);
        } catch (error) {
            helperLogger.error(`[${pluginId}] Error removing multi UI patch:`, error);
        }
    }

    public applyStyles(pluginId: string, css: string): void {
        try {
            if (this.styleElements.has(pluginId)) {
                return;
            }
            const style = document.createElement("style");
            style.id = `${pluginId}-styles`;
            style.textContent = css;
            document.head.appendChild(style);
            this.styleElements.set(pluginId, style);
        } catch (error) {
            helperLogger.error(`[${pluginId}] Error applying styles:`, error);
        }
    }

    public removeStyles(pluginId: string): void {
        try {
            this.styleElements.get(pluginId)?.remove();
            this.styleElements.delete(pluginId);
        } catch (error) {
            helperLogger.error(`[${pluginId}] Error removing styles:`, error);
        }
    }
}

export const pluginHelper = new PluginHelper();
