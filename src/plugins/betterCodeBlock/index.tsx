/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CodeSearchField, DEFAULT_HIGHLIGHT_CLASS, DEFAULT_HIGHLIGHT_CURRENT_CLASS } from "@plugins/betterCodeBlock/components/CodeSearchField";
import { Devs } from "@utils/constants";
import { injectStyles, MutationObserverManager, querySelector, querySelectorAll } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin } from "@utils/types";
import { createRoot, type Root } from "react-dom/client";

const logger = new Logger("BetterCodeBlock", "#a6d189");

const CODE_BLOCK_SELECTOR = "div.relative.not-prose.\\@container\\/code-block";
const BUTTONS_CONTAINER_SELECTOR = "div.absolute.bottom-1.right-1.flex.flex-row.gap-0\\.5";
const CODE_CONTAINER_SELECTOR = 'div[style*="display: block; overflow: auto; padding: 16px;"]';
const SEARCH_CONTAINER_ID = "grok-code-search-container";

const HIGHLIGHT_STYLE = `
:root {
    --highlight-bg: rgba(255, 255, 0, 0.3);
    --highlight-text: inherit;
    --current-highlight-bg: rgba(255, 165, 0, 0.5);
    --current-highlight-shadow: 0 0 4px rgba(255, 165, 0, 0.7);
    --highlight-radius: 2px;
    --highlight-padding: 0 2px;
    --highlight-transition: background-color 0.3s ease, box-shadow 0.3s ease;
}

.${DEFAULT_HIGHLIGHT_CLASS} {
    background-color: var(--highlight-bg);
    color: var(--highlight-text);
    border-radius: var(--highlight-radius);
    padding: var(--highlight-padding);
    transition: var(--highlight-transition);
}

.${DEFAULT_HIGHLIGHT_CURRENT_CLASS} {
    background-color: var(--current-highlight-bg);
    color: var(--highlight-text);
    border-radius: var(--highlight-radius);
    padding: var(--highlight-padding);
    box-shadow: var(--current-highlight-shadow);
    transition: var(--highlight-transition);
}
`;

export default definePlugin({
    name: "Better Code Block",
    description: "Adds a search field to the top of code blocks, allowing easy searching within the code.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["code", "search", "highlight"],
    patches: [
        {
            apply() {
                const styleInjection = injectStyles(HIGHLIGHT_STYLE, "better-codeblock-highlight");

                const reactRoots: Map<HTMLElement, Root> = new Map();
                const localObservers: Map<HTMLElement, MutationObserver> = new Map();
                const observerManager = new MutationObserverManager();

                const processCodeBlock = (codeBlock: HTMLElement) => {
                    if (codeBlock.querySelector(`#${SEARCH_CONTAINER_ID}`)) {
                        return;
                    }

                    const buttonsContainer = querySelector(BUTTONS_CONTAINER_SELECTOR, codeBlock);
                    if (!buttonsContainer) {
                        logger.warn("Buttons container not found in code block");
                        return;
                    }

                    const searchContainer = document.createElement("div");
                    searchContainer.id = SEARCH_CONTAINER_ID;
                    searchContainer.dataset.injectedBy = "better-code-block";

                    const copyButton = buttonsContainer.lastElementChild;
                    if (copyButton) {
                        buttonsContainer.insertBefore(searchContainer, copyButton);
                    } else {
                        buttonsContainer.appendChild(searchContainer);
                    }

                    let root: Root;
                    try {
                        root = createRoot(searchContainer);
                        reactRoots.set(codeBlock, root);
                    } catch (error) {
                        logger.error("Failed to create React root", error);
                        searchContainer.remove();
                        return;
                    }

                    const tryRender = () => {
                        const codeContainer = querySelector(CODE_CONTAINER_SELECTOR, codeBlock) as HTMLElement | null;
                        if (codeContainer) {
                            try {
                                root.render(
                                    <CodeSearchField
                                        codeElement={codeContainer}
                                    />
                                );
                            } catch (error) {
                                logger.error("Failed to render search field", error);
                            }
                            return true;
                        }
                        return false;
                    };

                    if (tryRender()) {
                        return;
                    }

                    const localObserver = new MutationObserver(mutations => {
                        for (const mutation of mutations) {
                            if (mutation.type === "childList") {
                                if (tryRender()) {
                                    localObserver.disconnect();
                                    localObservers.delete(codeBlock);
                                    break;
                                }
                            }
                        }
                    });

                    try {
                        localObserver.observe(codeBlock, { childList: true, subtree: true });
                        localObservers.set(codeBlock, localObserver);
                    } catch (error) {
                        logger.error("Failed to start local observer", error);
                        root.unmount();
                        reactRoots.delete(codeBlock);
                        searchContainer.remove();
                    }
                };

                const globalObserver = new MutationObserver(mutations => {
                    for (const mutation of mutations) {
                        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                            mutation.addedNodes.forEach(node => {
                                if (node instanceof HTMLElement) {
                                    if (node.matches(CODE_BLOCK_SELECTOR)) {
                                        processCodeBlock(node);
                                    } else {
                                        querySelectorAll(CODE_BLOCK_SELECTOR, node).forEach(processCodeBlock);
                                    }
                                }
                            });
                        } else if (mutation.type === "attributes" && mutation.target instanceof HTMLElement) {
                            if (mutation.target.matches(CODE_BLOCK_SELECTOR)) {
                                processCodeBlock(mutation.target);
                            }
                        }
                    }
                });

                try {
                    globalObserver.observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ["class", "style"],
                    });
                } catch (error) {
                    logger.error("Failed to start global observer", error);
                }

                try {
                    querySelectorAll(CODE_BLOCK_SELECTOR).forEach(processCodeBlock);
                } catch (error) {
                    logger.error("Failed to process initial code blocks", error);
                }

                return () => {
                    try {
                        globalObserver.disconnect();
                        localObservers.forEach(obs => obs.disconnect());
                        localObservers.clear();
                        reactRoots.forEach(root => root.unmount());
                        reactRoots.clear();

                        const allSearchContainers = querySelectorAll(`#${SEARCH_CONTAINER_ID}[data-injected-by="better-code-block"]`);
                        allSearchContainers.forEach(container => {
                            container.remove();
                        });

                        styleInjection.cleanup();
                        observerManager.disconnectAll();
                    } catch (error) {
                        logger.error("Error during plugin cleanup", error);
                    }
                };
            },
        },
    ],
});
