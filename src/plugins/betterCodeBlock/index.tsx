/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CodeSearchField } from "@components/CodeSearchField";
import { Devs } from "@utils/constants";
import { injectStyles, MutationObserverManager, querySelector, querySelectorAll } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";
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

let styleCleanup: (() => void) | null = null;

const betterCodeBlockPatch: IPatch = (() => {
    const reactRoots: Map<HTMLElement, Root> = new Map();
    let bodyObserverDisconnect: (() => void) | null = null;
    const localObservers: Map<HTMLElement, () => void> = new Map();
    const observerManager = new MutationObserverManager();

    function injectSearchField(codeBlockElement: HTMLElement, codeContainer: HTMLElement) {
        const searchContainer = document.createElement("div");
        searchContainer.id = SEARCH_CONTAINER_ID;
        searchContainer.style.display = "none";

        const buttonsContainer = querySelector(BUTTONS_CONTAINER_SELECTOR, codeBlockElement);
        if (!buttonsContainer) {
            logger.warn("Buttons container not found in code block");
            return;
        }

        const copyButton = buttonsContainer.lastElementChild;
        if (copyButton) {
            buttonsContainer.insertBefore(searchContainer, copyButton);
        } else {
            buttonsContainer.appendChild(searchContainer);
        }

        const reactRoot = createRoot(searchContainer);
        reactRoot.render(<CodeSearchField codeElement={codeContainer} />);
        reactRoots.set(codeBlockElement, reactRoot);

        requestAnimationFrame(() => {
            searchContainer.style.display = "";
        });
    }

    function addSearchToCodeBlock(codeBlockElement: HTMLElement) {
        if (codeBlockElement.querySelector(`#${SEARCH_CONTAINER_ID}`)) {
            return;
        }

        const codeContainer = querySelector(CODE_CONTAINER_SELECTOR, codeBlockElement);
        if (codeContainer) {
            injectSearchField(codeBlockElement, codeContainer as HTMLElement);
        } else {
            const { observe, disconnect } = observerManager.createObserver({
                target: codeBlockElement,
                options: { childList: true, subtree: true },
                callback: () => {
                    const codeContainerLocal = querySelector(CODE_CONTAINER_SELECTOR, codeBlockElement);
                    if (codeContainerLocal) {
                        injectSearchField(codeBlockElement, codeContainerLocal as HTMLElement);
                        disconnect();
                        localObservers.delete(codeBlockElement);
                    }
                },
            });
            observe();
            localObservers.set(codeBlockElement, disconnect);
        }
    }

    return {
        apply() {
            const { cleanup } = injectStyles(HIGHLIGHT_STYLE, "better-codeblock-highlight");
            styleCleanup = cleanup;

            const mutationCallback = (mutations: MutationRecord[]) => {
                for (const mutation of mutations) {
                    if (mutation.type === "childList") {
                        mutation.addedNodes.forEach(node => {
                            if (node instanceof HTMLElement) {
                                if (node.matches(CODE_BLOCK_SELECTOR)) {
                                    addSearchToCodeBlock(node);
                                }
                                const codeBlocks = querySelectorAll(CODE_BLOCK_SELECTOR, node);
                                codeBlocks.forEach(addSearchToCodeBlock);
                            }
                        });
                    } else if (mutation.type === "attributes") {
                        const target = mutation.target as HTMLElement;
                        if (target.matches(CODE_BLOCK_SELECTOR)) {
                            addSearchToCodeBlock(target);
                        }
                    }
                }
            };

            const { observe, disconnect } = observerManager.createObserver({
                target: document.body,
                options: { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] },
                callback: mutationCallback,
            });

            observe();
            bodyObserverDisconnect = disconnect;

            const initialCodeBlocks = querySelectorAll(CODE_BLOCK_SELECTOR);
            initialCodeBlocks.forEach(addSearchToCodeBlock);

            document.addEventListener("visibilitychange", () => {
                const codeBlocks = querySelectorAll(CODE_BLOCK_SELECTOR);
                codeBlocks.forEach(addSearchToCodeBlock);
            });
        },
        remove() {
            bodyObserverDisconnect?.();
            localObservers.forEach(disconnect => disconnect());
            localObservers.clear();
            reactRoots.forEach(root => root.unmount());
            reactRoots.clear();
            if (styleCleanup) {
                styleCleanup();
            }
            document.removeEventListener("visibilitychange", () => { });
            observerManager.disconnectAll();
        },
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
