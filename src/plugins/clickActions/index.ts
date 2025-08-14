/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { LOCATORS } from "@utils/locators";
import definePlugin, { type InjectedComponentProps, Patch } from "@utils/types";
import type React from "react";
import { useEffect } from "react";

const BUBBLE_SELECTOR = LOCATORS.CHAT.messageBubble.selector;
const ACTIONS_CONTAINER_SELECTOR = ".action-buttons" as const;
const ICON_BUTTON_SELECTOR = "button.h-8.w-8.rounded-full" as const;
const FALLBACK_BUTTONS_SELECTOR = `${ACTIONS_CONTAINER_SELECTOR} button, button` as const;
const INTERACTIVE_SELECTOR = "a,button,textarea,input,select,[role='button']" as const;

function isPencilLikeIconButton(btn: HTMLButtonElement): boolean {
    const hasRect = !!btn.querySelector("svg rect");
    if (hasRect) {
        return false;
    }
    const pathCount = btn.querySelectorAll("svg path").length;
    return pathCount >= 2;
}

function getCandidateButtons(root: HTMLElement): HTMLButtonElement[] {
    const iconButtons = Array.from(root.querySelectorAll<HTMLButtonElement>(ICON_BUTTON_SELECTOR));
    if (iconButtons.length > 0) {
        return iconButtons;
    }
    return Array.from(root.querySelectorAll<HTMLButtonElement>(FALLBACK_BUTTONS_SELECTOR));
}

function findEditButton(container: HTMLElement): HTMLButtonElement | null {
    const withinActions = container.querySelector<HTMLElement>(ACTIONS_CONTAINER_SELECTOR);
    const buttonSourceRoot = withinActions ?? container;
    const buttons = getCandidateButtons(buttonSourceRoot);
    if (buttons.length === 0) {
        return null;
    }
    const pencil = buttons.find(isPencilLikeIconButton);
    if (pencil) {
        return pencil;
    }
    const nonRect = buttons.find(b => !b.querySelector("svg rect"));
    if (nonRect) {
        return nonRect;
    }
    return buttons[0] ?? null;
}

const ClickActions: React.FC<InjectedComponentProps> = ({ rootElement: bubble }) => {
    useEffect(() => {
        if (!bubble) {
            return;
        }
        const onDoubleClick = (e: MouseEvent) => {
            if (bubble.querySelector("textarea")) {
                return;
            }
            const t = e.target as HTMLElement | null;
            if (t?.closest(INTERACTIVE_SELECTOR)) {
                return;
            }
            const container = bubble.closest<HTMLElement>(LOCATORS.CHAT.messageContainer.selector);
            if (!container) {
                return;
            }
            findEditButton(container)?.click();
        };

        bubble.addEventListener("dblclick", onDoubleClick);
        return () => bubble.removeEventListener("dblclick", onDoubleClick);
    }, [bubble]);

    return null;
};

export default definePlugin({
    name: "Click Actions",
    description: "Adds click actions, such as double-click to edit.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["edit", "double-click", "chat", "quality of life"],
    patches: [
        Patch.ui(BUBBLE_SELECTOR)
            .component(ClickActions)
            .forEach()
            .build(),
    ],
});
