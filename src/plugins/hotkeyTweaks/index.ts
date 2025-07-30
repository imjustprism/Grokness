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
    enterBehavior: {
        type: "select",
        displayName: "Chat Hotkey",
        description: "Customize how the Enter key works for sending messages.",
        default: "default",
        options: [
            { label: "Default (Enter to send)", value: "default" },
            { label: "Swap (Enter for newline, Shift+Enter to send)", value: "swap" },
            { label: "Ctrl+Enter to send", value: "ctrlEnter" },
        ],
    },
});

let trackedTextarea: HTMLTextAreaElement | null = null;
let observer: MutationObserver | null = null;
const selector = "div.query-bar textarea";

const handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== trackedTextarea || event.key !== "Enter") {
        return;
    }

    const behavior = settings.store.enterBehavior;

    if (behavior === "default") {
        return;
    }

    const currentTextarea = event.target as HTMLTextAreaElement;

    const sendMessage = () => {
        const form = currentTextarea.closest("form");
        form?.requestSubmit();
    };

    const addNewLine = () => {
        const { selectionStart, selectionEnd, value } = currentTextarea;
        const newValue = `${value.substring(0, selectionStart)}\n${value.substring(selectionEnd)}`;

        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")
            ?.set?.call(currentTextarea, newValue);

        currentTextarea.dispatchEvent(new Event("input", { bubbles: true }));

        const newPosition = selectionStart + 1;
        currentTextarea.selectionStart = newPosition;
        currentTextarea.selectionEnd = newPosition;
    };

    if (behavior === "swap") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.shiftKey) {
            sendMessage();
        } else {
            addNewLine();
        }
    } else if (behavior === "ctrlEnter") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.ctrlKey) {
            sendMessage();
        } else {
            addNewLine();
        }
    }
};

export default definePlugin({
    name: "Hotkey Tweaks",
    id: "enter-key-swap",
    description: "Customizes the keyboard shortcuts for sending messages and creating new lines.",
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
