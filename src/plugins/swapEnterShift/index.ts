/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { querySelector } from "@utils/dom";
import { definePluginSettings } from "@utils/settings";
import { definePlugin } from "@utils/types";

const settings = definePluginSettings({
    swapBehavior: {
        type: "boolean",
        displayName: "Swap Enter/Shift Behavior",
        description: "Enables Enter for new lines and Shift+Enter for sending messages.",
        default: true,
    },
});

let trackedTextarea: HTMLTextAreaElement | null = null;
let observer: MutationObserver | null = null;
const selector = "div.query-bar textarea";

const handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== trackedTextarea || !settings.store.swapBehavior || event.key !== "Enter") {
        return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const currentTextarea = event.target as HTMLTextAreaElement;

    if (event.shiftKey) {
        const form = currentTextarea.closest("form");
        form?.requestSubmit();
    } else {
        const { selectionStart, selectionEnd, value } = currentTextarea;
        const newValue = `${value.substring(0, selectionStart)}\n${value.substring(selectionEnd)}`;

        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")
            ?.set?.call(currentTextarea, newValue);

        currentTextarea.dispatchEvent(new Event("input", { bubbles: true }));

        const newPosition = selectionStart + 1;
        currentTextarea.selectionStart = newPosition;
        currentTextarea.selectionEnd = newPosition;
    }
};

export default definePlugin({
    name: "Enter Key Swap",
    id: "enter-key-swap",
    description: "Reverses the 'Enter' and 'Shift+Enter' behavior in the chat input.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["input", "enter", "send", "chat", "quality of life"],
    settings,

    start() {
        document.addEventListener("keydown", handleDocumentKeyDown, { capture: true });

        const observerCallback = () => {
            trackedTextarea = querySelector(selector) as HTMLTextAreaElement | null;
        };

        observer = new MutationObserver(observerCallback);
        observer.observe(document.body, { childList: true, subtree: true });
        observerCallback();
    },

    stop() {
        document.removeEventListener("keydown", handleDocumentKeyDown, { capture: true });
        observer?.disconnect();
        trackedTextarea = null;
    },
});
