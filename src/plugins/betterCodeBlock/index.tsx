/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CodeSearchField } from "@plugins/betterCodeBlock/components/CodeSearchField";
import styles from "@plugins/betterCodeBlock/styles.css?raw";
import { Devs } from "@utils/constants";
import { MutationObserverManager, querySelector, querySelectorAll } from "@utils/dom";
import { definePlugin, type IPatch } from "@utils/types";
import { createRoot, type Root } from "react-dom/client";

const CODE_BLOCK_SELECTOR = "div.relative.not-prose.\\@container\\/code-block";
const BUTTONS_CONTAINER_SELECTOR = "div.absolute.bottom-1.right-1.flex.flex-row.gap-0\\.5";
const SEARCH_CONTAINER_ID = "grok-code-search-container";

const betterCodeBlockPatch: IPatch = (() => {
    const observerManager = new MutationObserverManager();
    const roots = new Map<HTMLElement, Root>();
    let disconnect: (() => void) | null = null;

    const processCodeBlock = (codeBlock: HTMLElement) => {
        if (codeBlock.querySelector(`#${SEARCH_CONTAINER_ID}`)) {
            return;
        }

        const buttonsContainer = querySelector(BUTTONS_CONTAINER_SELECTOR, codeBlock);
        if (!buttonsContainer) {
            return;
        }

        const searchContainer = document.createElement("div");
        searchContainer.id = SEARCH_CONTAINER_ID;
        buttonsContainer.insertBefore(searchContainer, buttonsContainer.lastElementChild);

        const root = createRoot(searchContainer);
        roots.set(searchContainer, root);
        root.render(<CodeSearchField />);
    };

    return {
        apply() {
            querySelectorAll(CODE_BLOCK_SELECTOR).forEach(processCodeBlock);

            const observer = observerManager.createObserver({
                target: document.body,
                options: { childList: true, subtree: true },
                callback: mutations => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (node instanceof HTMLElement) {
                                if (node.matches(CODE_BLOCK_SELECTOR)) {
                                    processCodeBlock(node);
                                }
                                node.querySelectorAll(CODE_BLOCK_SELECTOR).forEach(el => processCodeBlock(el as HTMLElement));
                            }
                        }
                    }
                },
            });

            observer.observe();
            disconnect = observer.disconnect;
        },
        remove() {
            disconnect?.();
            roots.forEach((root, container) => {
                root.unmount();
                container.remove();
            });
            roots.clear();
        },
    };
})();

export default definePlugin({
    name: "Better Code Block",
    description: "Adds a search field to all code blocks.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["code", "search", "highlight"],
    styles,
    patches: [betterCodeBlockPatch],
});
