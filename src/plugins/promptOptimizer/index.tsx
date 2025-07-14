/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IconButton } from "@components/IconButton";
import { Devs } from "@utils/constants";
import { MutationObserverManager, querySelector, querySelectorAll } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";
import { createRoot, type Root } from "react-dom/client";

const logger = new Logger("PromptOptimizer", "#a6d189");

const USER_PROMPT_SELECTOR = "div.message-bubble.bg-surface-l2.border.border-border-l1";
const PROMPT_CONTENT_SELECTOR = "span.whitespace-pre-wrap";
const COLLAPSE_CONTAINER_ID = "grok-prompt-collapse-container";

const CHARACTER_LIMIT = 3500;

const promptOptimizerPatch: IPatch = (() => {
    const reactRoots: Map<HTMLElement, Root> = new Map();
    let bodyObserverDisconnect: (() => void) | null = null;
    const localObservers: Map<HTMLElement, () => void> = new Map();
    const observerManager = new MutationObserverManager();
    const storedContents: Map<HTMLElement, string> = new Map();

    function addCollapseToPrompt(promptElement: HTMLElement) {
        if (promptElement.querySelector(`#${COLLAPSE_CONTAINER_ID}`)) {
            return;
        }

        const contentElement = querySelector(PROMPT_CONTENT_SELECTOR, promptElement);
        if (!contentElement) {
            logger.warn("Content element not found in prompt");
            return;
        }

        const promptText = contentElement.textContent || "";
        if (promptText.length <= CHARACTER_LIMIT) {
            return;
        }

        storedContents.set(promptElement, promptText);

        promptElement.style.position = "relative";
        promptElement.style.paddingRight = "2.5rem";

        const collapseContainer = document.createElement("div");
        collapseContainer.id = COLLAPSE_CONTAINER_ID;
        collapseContainer.className = "absolute top-1 right-2";

        contentElement.textContent = `Prompt collapsed (length: ${promptText.length} chars). Click to expand.`;
        contentElement.style.opacity = "0.7";

        const reactRoot = createRoot(collapseContainer);
        reactRoot.render(
            <IconButton
                icon="ChevronDown"
                size="sm"
                variant="ghost"
                onClick={() => togglePrompt(promptElement)}
                tooltipContent="Expand prompt"
            />
        );
        reactRoots.set(promptElement, reactRoot);

        promptElement.appendChild(collapseContainer);
    }

    function togglePrompt(promptElement: HTMLElement) {
        const contentElement = querySelector(PROMPT_CONTENT_SELECTOR, promptElement);
        if (!contentElement) {
            return;
        }

        const collapseContainer = promptElement.querySelector(`#${COLLAPSE_CONTAINER_ID}`);
        if (!collapseContainer) {
            return;
        }

        const isCollapsed = !storedContents.has(promptElement) || contentElement.textContent !== storedContents.get(promptElement);

        if (isCollapsed) {
            const originalText = storedContents.get(promptElement);
            if (originalText) {
                contentElement.textContent = originalText;
                contentElement.style.opacity = "1";
            }
            const reactRoot = reactRoots.get(promptElement);
            if (reactRoot) {
                reactRoot.render(
                    <IconButton
                        icon="ChevronUp"
                        size="sm"
                        variant="ghost"
                        onClick={() => togglePrompt(promptElement)}
                        tooltipContent="Collapse prompt"
                    />
                );
            }
        } else {
            const currentText = contentElement.textContent || "";
            storedContents.set(promptElement, currentText);
            contentElement.textContent = `Prompt collapsed (length: ${currentText.length} chars). Click to expand.`;
            contentElement.style.opacity = "0.7";
            const reactRoot = reactRoots.get(promptElement);
            if (reactRoot) {
                reactRoot.render(
                    <IconButton
                        icon="ChevronDown"
                        size="sm"
                        variant="ghost"
                        onClick={() => togglePrompt(promptElement)}
                        tooltipContent="Expand prompt"
                    />
                );
            }
        }
    }

    return {
        apply() {
            const mutationCallback = (mutations: MutationRecord[]) => {
                for (const mutation of mutations) {
                    if (mutation.type === "childList") {
                        mutation.addedNodes.forEach(node => {
                            if (node instanceof HTMLElement) {
                                if (node.matches(USER_PROMPT_SELECTOR)) {
                                    addCollapseToPrompt(node);
                                }
                                const prompts = querySelectorAll(USER_PROMPT_SELECTOR, node);
                                prompts.forEach(addCollapseToPrompt);
                            }
                        });
                    }
                }
            };

            const { observe, disconnect } = observerManager.createObserver({
                target: document.body,
                options: { childList: true, subtree: true },
                callback: mutationCallback,
            });

            observe();
            bodyObserverDisconnect = disconnect;

            const initialPrompts = querySelectorAll(USER_PROMPT_SELECTOR);
            initialPrompts.forEach(addCollapseToPrompt);
        },
        remove() {
            bodyObserverDisconnect?.();
            localObservers.forEach(disconnect => disconnect());
            localObservers.clear();
            reactRoots.forEach(root => root.unmount());
            reactRoots.clear();
            storedContents.clear();
            observerManager.disconnectAll();
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
