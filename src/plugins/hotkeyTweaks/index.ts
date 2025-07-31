/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
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

const TEXTAREA_SELECTOR = "div.query-bar textarea, div.message-bubble textarea";

const handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (
        !(event.target instanceof HTMLTextAreaElement) ||
        !event.target.matches(TEXTAREA_SELECTOR) ||
        event.key !== "Enter"
    ) {
        return;
    }

    const behavior = settings.store.enterBehavior;

    if (behavior === "default") {
        return;
    }

    const currentTextarea = event.target;

    const sendMessage = () => {
        const form = currentTextarea.closest("form");
        const saveButton = currentTextarea.closest(".message-bubble")?.querySelector<HTMLButtonElement>("button:last-of-type");

        if (form) {
            form.requestSubmit();
        } else if (saveButton) {
            saveButton.click();
        }
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

    event.preventDefault();
    event.stopImmediatePropagation();

    if (behavior === "swap") {
        if (event.shiftKey) {
            sendMessage();
        } else {
            addNewLine();
        }
    } else if (behavior === "ctrlEnter") {
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
    },

    stop() {
        document.removeEventListener("keydown", handleDocumentKeyDown, { capture: true });
    },
});
