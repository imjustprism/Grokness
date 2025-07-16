/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IconButton } from "@components/IconButton";
import collapsedStyles from "@plugins/promptOptimizer/styles.css?raw";
import { Devs } from "@utils/constants";
import { injectStyles, MutationObserverManager, querySelector, querySelectorAll } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";
import { createRoot, type Root } from "react-dom/client";

const logger = new Logger("PromptOptimizer", "#a6d189");

const userPromptSelector = "div.message-bubble.bg-surface-l2.border.border-border-l1";
const promptContentSelector = "span.whitespace-pre-wrap";
const collapseContainerId = "grok-prompt-collapse-container";

const characterLimit = 3500;
const collapsedClassName = "collapsed-prompt";
const badgeClassName = "collapsed-prompt-badge";
const stylesId = "prompt-optimizer-styles";

const additionalPaddingTop = "0.75rem";
const promptPaddingRight = "2.5rem";

const promptOptimizerPatch: IPatch = (() => {
    const reactRootsMap: Map<HTMLElement, Root> = new Map();
    let bodyObserverDisconnectCallback: (() => void) | null = null;
    const collapsedMessagesMap: Map<HTMLElement, HTMLElement> = new Map();
    const originalStylesMap: Map<HTMLElement, { paddingTop: string; paddingRight: string; }> = new Map();
    const mutationObserverManager = new MutationObserverManager();
    let stylesCleanupCallback: (() => void) | null = null;

    function createCollapsedMessageElement(characterLength: number): HTMLElement {
        const collapsedMessageElement = document.createElement("span");
        collapsedMessageElement.className = collapsedClassName;

        const initialTextSpan = document.createElement("span");
        initialTextSpan.textContent = "Long prompt collapsed ";

        const badgeSpan = document.createElement("span");
        badgeSpan.className = badgeClassName;
        badgeSpan.textContent = `${characterLength} characters`;

        collapsedMessageElement.appendChild(initialTextSpan);
        collapsedMessageElement.appendChild(badgeSpan);

        return collapsedMessageElement;
    }

    function applyInlineButtonClass(collapseContainerElement: HTMLElement) {
        collapseContainerElement.classList.remove("collapse-button-absolute");
        collapseContainerElement.classList.add("collapse-button-inline");
    }

    function applyAbsoluteButtonClass(collapseContainerElement: HTMLElement) {
        collapseContainerElement.classList.remove("collapse-button-inline");
        collapseContainerElement.classList.add("collapse-button-absolute");
    }

    function addCollapseFeatureToPrompt(promptElement: HTMLElement): void {
        try {
            if (promptElement.querySelector(`#${collapseContainerId}`)) {
                return;
            }

            const contentElement = querySelector(promptContentSelector, promptElement);
            if (!contentElement) {
                logger.warn("Content element not found in prompt");
                return;
            }

            const promptTextLength = contentElement.textContent?.length ?? 0;
            if (promptTextLength <= characterLimit) {
                return;
            }

            const originalPaddingTopValue = promptElement.style.paddingTop || "";
            const originalPaddingRightValue = promptElement.style.paddingRight || "";
            originalStylesMap.set(promptElement, {
                paddingTop: originalPaddingTopValue,
                paddingRight: originalPaddingRightValue
            });

            const collapseContainerElement = document.createElement("div");
            collapseContainerElement.id = collapseContainerId;

            const reactRootInstance = createRoot(collapseContainerElement);
            reactRootInstance.render(
                <IconButton
                    icon="ChevronDown"
                    size="sm"
                    variant="ghost"
                    onClick={() => togglePromptVisibility(promptElement)}
                    tooltipContent="Expand prompt"
                />
            );
            reactRootsMap.set(promptElement, reactRootInstance);

            const collapsedMessageElement = createCollapsedMessageElement(promptTextLength);
            collapsedMessageElement.appendChild(collapseContainerElement);
            promptElement.insertBefore(collapsedMessageElement, contentElement);
            contentElement.style.display = "none";
            collapsedMessagesMap.set(promptElement, collapsedMessageElement);
            applyInlineButtonClass(collapseContainerElement);
        } catch (error) {
            logger.error("Error adding collapse to prompt:", error);
        }
    }

    function togglePromptVisibility(promptElement: HTMLElement): void {
        try {
            const contentElement = querySelector(promptContentSelector, promptElement);
            if (!contentElement) {
                logger.warn("Content element not found during toggle");
                return;
            }

            const collapseContainerElement = promptElement.querySelector(`#${collapseContainerId}`) as HTMLElement | null;
            if (!collapseContainerElement) {
                logger.warn("Collapse container not found during toggle");
                return;
            }

            const isCurrentlyCollapsed = collapsedMessagesMap.has(promptElement);
            const reactRootInstance = reactRootsMap.get(promptElement);

            if (isCurrentlyCollapsed) {
                const collapsedMessageElement = collapsedMessagesMap.get(promptElement);
                if (collapsedMessageElement) {
                    collapsedMessageElement.removeChild(collapseContainerElement);
                    promptElement.appendChild(collapseContainerElement);
                    applyAbsoluteButtonClass(collapseContainerElement);
                    promptElement.style.position = "relative";
                    promptElement.style.paddingTop = `calc(${originalStylesMap.get(promptElement)?.paddingTop || "0px"} + ${additionalPaddingTop})`;
                    promptElement.style.paddingRight = promptPaddingRight;
                    collapsedMessageElement.remove();
                }
                collapsedMessagesMap.delete(promptElement);
                contentElement.style.display = "";
                if (reactRootInstance) {
                    reactRootInstance.render(
                        <IconButton
                            icon="ChevronUp"
                            size="sm"
                            variant="ghost"
                            onClick={() => togglePromptVisibility(promptElement)}
                            tooltipContent="Collapse prompt"
                        />
                    );
                } else {
                    logger.warn("React root not found for expand");
                }
            } else {
                promptElement.style.position = "";
                promptElement.style.paddingTop = originalStylesMap.get(promptElement)?.paddingTop || "";
                promptElement.style.paddingRight = originalStylesMap.get(promptElement)?.paddingRight || "";

                const promptTextLength = contentElement.textContent?.length || 0;
                const collapsedMessageElement = createCollapsedMessageElement(promptTextLength);

                promptElement.insertBefore(collapsedMessageElement, contentElement);
                contentElement.style.display = "none";
                collapsedMessagesMap.set(promptElement, collapsedMessageElement);

                promptElement.removeChild(collapseContainerElement);
                collapsedMessageElement.appendChild(collapseContainerElement);
                applyInlineButtonClass(collapseContainerElement);

                if (reactRootInstance) {
                    reactRootInstance.render(
                        <IconButton
                            icon="ChevronDown"
                            size="sm"
                            variant="ghost"
                            onClick={() => togglePromptVisibility(promptElement)}
                            tooltipContent="Expand prompt"
                        />
                    );
                } else {
                    logger.warn("React root not found for collapse");
                }
            }
        } catch (error) {
            logger.error("Error toggling prompt:", error);
        }
    }

    return {
        apply() {
            try {
                const { cleanup } = injectStyles(collapsedStyles, stylesId);
                stylesCleanupCallback = cleanup;

                const mutationCallback = (mutations: MutationRecord[]) => {
                    try {
                        for (const mutation of mutations) {
                            if (mutation.type === "childList") {
                                mutation.addedNodes.forEach(node => {
                                    if (node instanceof HTMLElement) {
                                        if (node.matches(userPromptSelector)) {
                                            addCollapseFeatureToPrompt(node);
                                        }
                                        const prompts = querySelectorAll(userPromptSelector, node);
                                        prompts.forEach(addCollapseFeatureToPrompt);
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        logger.error("Error in mutation callback:", error);
                    }
                };

                const { observe, disconnect } = mutationObserverManager.createObserver({
                    target: document.body,
                    options: { childList: true, subtree: true },
                    callback: mutationCallback,
                });

                observe();
                bodyObserverDisconnectCallback = disconnect;

                const initialPrompts = querySelectorAll(userPromptSelector);
                initialPrompts.forEach(addCollapseFeatureToPrompt);
            } catch (error) {
                logger.error("Error applying prompt optimizer patch:", error);
            }
        },
        remove() {
            try {
                bodyObserverDisconnectCallback?.();
                reactRootsMap.forEach((root, promptElement) => {
                    root.unmount();

                    const collapseContainerElement = promptElement.querySelector(`#${collapseContainerId}`);
                    collapseContainerElement?.remove();

                    if (collapsedMessagesMap.has(promptElement)) {
                        const collapsedMessageElement = collapsedMessagesMap.get(promptElement);
                        collapsedMessageElement?.remove();

                        const contentElement = querySelector(promptContentSelector, promptElement);
                        if (contentElement) {
                            contentElement.style.display = "";
                        }
                    }

                    const originalStyle = originalStylesMap.get(promptElement);
                    if (originalStyle) {
                        promptElement.style.paddingTop = originalStyle.paddingTop;
                        promptElement.style.paddingRight = originalStyle.paddingRight;
                    } else {
                        promptElement.style.paddingTop = "";
                        promptElement.style.paddingRight = "";
                    }

                    promptElement.style.position = "";
                });
                reactRootsMap.clear();
                collapsedMessagesMap.clear();
                originalStylesMap.clear();
                mutationObserverManager.disconnectAll();
                stylesCleanupCallback?.();
            } catch (error) {
                logger.error("Error removing prompt optimizer patch:", error);
            }
        },
    };
})();

export default definePlugin({
    name: "Prompt Optimizer",
    description: "Automatically collapses long user prompts in chat for better performance.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["prompt", "optimize", "collapse"],
    patches: [promptOptimizerPatch],
});
