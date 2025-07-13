/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from "react";

export const useTabLogic = (dialogElement: HTMLElement) => {
    const [isActiveTab, setIsActiveTab] = useState(false);

    const contentContainer = dialogElement.querySelector<HTMLElement>('[class*="flex-1"]');
    const sidebarContainer =
        contentContainer?.parentElement?.querySelector<HTMLElement>("div > div");

    useEffect(() => {
        if (!sidebarContainer) {
            return;
        }

        const handleClickEvent = (e: MouseEvent) => {
            const clickedButton = (e.target as HTMLElement).closest("button");
            if (!clickedButton) {
                return;
            }

            const groknessButton = sidebarContainer.querySelector("button[data-grokness]");
            if (!groknessButton) {
                return;
            }

            if (clickedButton.hasAttribute("data-grokness")) {
                setIsActiveTab(true);
                sidebarContainer.querySelectorAll("button").forEach(button => {
                    if (button !== groknessButton) {
                        button.setAttribute("aria-selected", "false");
                        button.classList.remove("bg-button-ghost-hover");
                    }
                });
                groknessButton.setAttribute("aria-selected", "true");
                groknessButton.classList.add("bg-button-ghost-hover");
            } else {
                setIsActiveTab(false);
                groknessButton.setAttribute("aria-selected", "false");
                groknessButton.classList.remove("bg-button-ghost-hover");
                clickedButton.setAttribute("aria-selected", "true");
                clickedButton.classList.add("bg-button-ghost-hover");
            }
        };
        sidebarContainer.addEventListener("click", handleClickEvent);
        return () => sidebarContainer.removeEventListener("click", handleClickEvent);
    }, [sidebarContainer]);

    useEffect(() => {
        if (!contentContainer) {
            return;
        }

        Array.from(contentContainer.children).forEach(childElement => {
            const element = childElement as HTMLElement;
            if (element.hasAttribute("data-grokness-panel")) {
                element.style.display = isActiveTab ? "flex" : "none";
            } else {
                element.style.display = isActiveTab ? "none" : "flex";
            }
        });
    }, [isActiveTab, contentContainer]);

    useEffect(() => {
        if (!sidebarContainer) {
            return;
        }

        if (!sidebarContainer.querySelector("[data-grokness]")) {
            const tabButton = document.createElement("button");
            tabButton.setAttribute("data-grokness", "");
            tabButton.setAttribute("aria-selected", "false");
            tabButton.className = [
                "inline-flex items-center gap-3 px-4 h-10 rounded-xl",
                isActiveTab
                    ? "text-primary bg-button-ghost-hover"
                    : "text-fg-primary hover:bg-card-hover",
            ].join(" ");
            tabButton.innerHTML = `<svg class="lucide lucide-user ${isActiveTab ? "text-primary" : "text-secondary"
                }"></svg>Grokness`;
            sidebarContainer.appendChild(tabButton);
        }
    }, [sidebarContainer, isActiveTab]);

    return {
        isActive: isActiveTab,
        contentContainer,
        sidebarContainer,
    };
};
