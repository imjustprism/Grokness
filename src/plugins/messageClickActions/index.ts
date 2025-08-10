/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { liveElements, selectOne } from "@utils/dom";
import { LOCATORS } from "@utils/locators";
import { definePlugin } from "@utils/types";

const BUBBLE = LOCATORS.CHAT.messageBubble.selector;
const ATTR = "data-quick-actions-listener";

const onDbl = (e: MouseEvent): void => {
    const bubble = e.currentTarget as HTMLElement;
    const container = bubble.closest<HTMLElement>(LOCATORS.CHAT.messageContainer.selector);
    if (!container) {
        return;
    }
    const edit = selectOne<HTMLButtonElement>(LOCATORS.CHAT.editButton, container);
    edit?.click();
};

function attach(el: HTMLElement): void {
    if (el.hasAttribute(ATTR)) {
        return;
    }
    el.setAttribute(ATTR, "true");
    el.addEventListener("dblclick", onDbl);
}

function detach(el: HTMLElement): void {
    el.removeAttribute(ATTR);
    el.removeEventListener("dblclick", onDbl);
}

let detachLive: (() => void) | null = null;

export default definePlugin({
    name: "Message Click Actions",
    description: "Adds click actions, such as double-click to edit.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["edit", "double-click", "chat", "quality of life"],

    start() {
        const { disconnect } = liveElements<HTMLElement>(BUBBLE, document, attach, detach, { debounce: 50 });
        detachLive = disconnect;
    },

    stop() {
        detachLive?.();
        detachLive = null;
        document.querySelectorAll<HTMLElement>(BUBBLE).forEach(detach);
    },
});
