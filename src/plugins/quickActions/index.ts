/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { MutationObserverManager, querySelector, querySelectorAll } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";

const logger = new Logger("QuickkActions", "#89b4fa");

const USER_MESSAGE_BUBBLE_SELECTOR = "div.message-bubble.bg-surface-l2";
const LISTENER_ATTRIBUTE = "data-quick-actions-listener";

const handleDoubleClick = (event: MouseEvent): void => {
    const bubble = event.currentTarget as HTMLElement;
    if (!bubble) {
        return;
    }

    const messageContainer = bubble.closest<HTMLElement>("div.relative.group");
    if (!messageContainer) {
        logger.warn("Could not find the parent message container for the bubble.");
        return;
    }

    const editButton = querySelector('button[aria-label="Edit"]', messageContainer) as HTMLButtonElement | null;
    if (!editButton) {
        logger.warn("Could not find the 'Edit' button.");
        return;
    }

    editButton.click();
};

const addListenerToBubble = (element: HTMLElement): void => {
    if (element.hasAttribute(LISTENER_ATTRIBUTE)) {
        return;
    }
    element.setAttribute(LISTENER_ATTRIBUTE, "true");
    element.addEventListener("dblclick", handleDoubleClick);
};

const removeListenerFromBubble = (element: HTMLElement): void => {
    element.removeAttribute(LISTENER_ATTRIBUTE);
    element.removeEventListener("dblclick", handleDoubleClick);
};

const quickActionsPatch: IPatch = (() => {
    const observerManager = new MutationObserverManager();
    let observerDisconnect: (() => void) | null = null;

    return {
        apply() {
            querySelectorAll(USER_MESSAGE_BUBBLE_SELECTOR).forEach(addListenerToBubble);

            const { observe, disconnect } = observerManager.createObserver({
                target: document.body,
                options: { childList: true, subtree: true },
                callback: mutations => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (node instanceof HTMLElement) {
                                if (node.matches(USER_MESSAGE_BUBBLE_SELECTOR)) {
                                    addListenerToBubble(node);
                                }
                                node.querySelectorAll(USER_MESSAGE_BUBBLE_SELECTOR).forEach(el => addListenerToBubble(el as HTMLElement));
                            }
                        }
                    }
                },
            });

            observerDisconnect = disconnect;
            observe();
        },
        remove() {
            observerDisconnect?.();
            querySelectorAll(USER_MESSAGE_BUBBLE_SELECTOR).forEach(removeListenerFromBubble);
        },
    };
})();

export default definePlugin({
    name: "Quick Actions",
    description: "Adds quick actions to chat, like double-clicking a message to edit it.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["edit", "double-click", "chat", "quality of life"],
    patches: [quickActionsPatch],
});
