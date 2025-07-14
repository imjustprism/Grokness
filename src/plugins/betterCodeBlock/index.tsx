/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CodeSearchField } from "@components/CodeSearchField";
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
.grok-code-highlight {
    background-color: yellow;
    color: black;
}
.grok-code-highlight-current {
    background-color: orange;
    color: black;
}
`;

export default definePlugin({
    name: "BetterCodeBlock",
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
                        logger.debug("Search container already exists, skipping");
                        return;
                    }

                    const buttonsContainer = querySelector(BUTTONS_CONTAINER_SELECTOR, codeBlock);
                    if (!buttonsContainer) {
                        logger.warn("Buttons container not found in code block");
                        return;
                    }

                    const codeContainer = querySelector(CODE_CONTAINER_SELECTOR, codeBlock);
                    if (codeContainer) {
                        const searchContainer = document.createElement("div");
                        searchContainer.id = SEARCH_CONTAINER_ID;
                        searchContainer.dataset.injectedBy = "better-code-block";

                        const copyButton = buttonsContainer.lastElementChild;
                        if (copyButton) {
                            buttonsContainer.insertBefore(searchContainer, copyButton);
                        } else {
                            buttonsContainer.appendChild(searchContainer);
                        }

                        try {
                            const root = createRoot(searchContainer);
                            root.render(<CodeSearchField codeElement={codeContainer as HTMLElement} />);
                            reactRoots.set(codeBlock, root);
                            logger.debug("Successfully injected search field");
                        } catch (error) {
                            logger.error("Failed to render search field", error);
                            searchContainer.remove();
                        }
                    } else {
                        const localObserver = new MutationObserver(mutations => {
                            for (const mutation of mutations) {
                                if (mutation.type === "childList") {
                                    const addedCodeContainer = querySelector(CODE_CONTAINER_SELECTOR, codeBlock);
                                    if (addedCodeContainer) {
                                        processCodeBlock(codeBlock);
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
                            logger.debug("Started local observer for code container");
                        } catch (error) {
                            logger.error("Failed to start local observer", error);
                        }
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
                    logger.debug("Global observer started");
                } catch (error) {
                    logger.error("Failed to start global observer", error);
                }

                try {
                    querySelectorAll(CODE_BLOCK_SELECTOR).forEach(processCodeBlock);
                    logger.debug("Initial code blocks processed");
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
                        logger.debug(`Removed ${allSearchContainers.length} search containers`);

                        styleInjection.cleanup();
                        observerManager.disconnectAll();
                        logger.info("Plugin cleanup completed successfully");
                    } catch (error) {
                        logger.error("Error during plugin cleanup", error);
                    }
                };
            },
        },
    ],
});
