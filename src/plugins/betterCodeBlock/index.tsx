/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CodeSearchField } from "@plugins/betterCodeBlock/components/CodeSearchField";
import styles from "@plugins/betterCodeBlock/styles.css?raw";
import { Devs } from "@utils/constants";
import { MutationObserverManager, querySelector, querySelectorAll } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin } from "@utils/types";
import { createRoot, type Root } from "react-dom/client";

const logger = new Logger("BetterCodeBlock", "#a6d189");

const CODE_BLOCK_SELECTOR = "div.relative.not-prose.\\@container\\/code-block";
const BUTTONS_CONTAINER_SELECTOR = "div.absolute.bottom-1.right-1.flex.flex-row.gap-0\\.5";
const CODE_CONTAINER_SELECTOR = 'div[style*="display: block; overflow: auto; padding: 16px;"]';
const SEARCH_CONTAINER_ID = "grok-code-search-container";

const betterCodeBlockPatch = (() => {
    let styleElement: HTMLStyleElement | null = null;
    const reactRoots: Map<HTMLElement, Root> = new Map();
    const localDisconnects: Map<HTMLElement, () => void> = new Map();
    const observerManager = new MutationObserverManager();
    let globalDisconnect: (() => void) | null = null;

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

        const { observe: localObserve, disconnect: localDisconnect } = observerManager.createObserver({
            target: codeBlock,
            options: { childList: true, subtree: true },
            callback: mutations => {
                for (const mutation of mutations) {
                    if (mutation.type === "childList") {
                        if (tryRender()) {
                            localDisconnect();
                            localDisconnects.delete(codeBlock);
                            break;
                        }
                    }
                }
            }
        });

        try {
            localObserve();
            localDisconnects.set(codeBlock, localDisconnect);
        } catch (error) {
            logger.error("Failed to start local observer", error);
            root.unmount();
            reactRoots.delete(codeBlock);
            searchContainer.remove();
        }
    };

    return {
        apply() {
            try {
                styleElement = document.createElement("style");
                styleElement.id = "better-codeblock-highlight";
                styleElement.textContent = styles;
                document.head.appendChild(styleElement);
            } catch (error) {
                logger.error("Failed to inject styles", error);
            }

            const { observe, disconnect } = observerManager.createObserver({
                target: document.body,
                options: {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ["class", "style"],
                },
                callback: mutations => {
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
                }
            });

            try {
                observe();
                globalDisconnect = disconnect;
            } catch (error) {
                logger.error("Failed to start global observer", error);
            }

            try {
                querySelectorAll(CODE_BLOCK_SELECTOR).forEach(processCodeBlock);
            } catch (error) {
                logger.error("Failed to process initial code blocks", error);
            }
        },
        remove() {
            try {
                globalDisconnect?.();
                localDisconnects.forEach(disconnect => disconnect());
                localDisconnects.clear();
                reactRoots.forEach(root => root.unmount());
                reactRoots.clear();

                const allSearchContainers = querySelectorAll(`#${SEARCH_CONTAINER_ID}[data-injected-by="better-code-block"]`);
                allSearchContainers.forEach(container => {
                    container.remove();
                });

                styleElement?.remove();
                styleElement = null;
                observerManager.disconnectAll();
            } catch (error) {
                logger.error("Error during plugin cleanup", error);
            }
        }
    };
})();

export default definePlugin({
    name: "Better Code Block",
    description: "Adds a search field to the top of code blocks, allowing easy searching within the code.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["code", "search", "highlight"],
    patches: [betterCodeBlockPatch],
});
