/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { querySelector, querySelectorAll } from "@utils/dom";
import { useEffect, useState } from "react";

export const useTabLogic = (dialogElement: HTMLElement) => {
    const [isTabActive, setIsTabActive] = useState<boolean>(false);

    const contentAreaElement = querySelector('div[class*="flex-1"]', dialogElement) as HTMLElement | null;

    const parentArea = contentAreaElement?.parentElement ?? null;
    const sidebarAreaElement = parentArea ? querySelector("div > div", parentArea) as HTMLElement | null : null;

    useEffect(() => {
        if (!sidebarAreaElement) {
            return;
        }

        const handleTabClick = (event: MouseEvent) => {
            const targetTabButton = (event.target as HTMLElement).closest("button");
            if (!targetTabButton) {
                return;
            }

            const groknessTabButton = querySelector("button[data-grokness]", sidebarAreaElement);
            if (!groknessTabButton) {
                return;
            }

            const isGrokness = targetTabButton.hasAttribute("data-grokness");
            setIsTabActive(isGrokness);

            querySelectorAll("button", sidebarAreaElement).forEach(sidebarButton => {
                const active = sidebarButton === targetTabButton;
                sidebarButton.setAttribute("aria-selected", active ? "true" : "false");

                if (active) {
                    sidebarButton.classList.add("text-primary", "bg-button-ghost-hover", "[&>svg]:text-primary");
                    sidebarButton.classList.remove("text-fg-primary");
                } else {
                    sidebarButton.classList.remove("text-primary", "bg-button-ghost-hover", "[&>svg]:text-primary");
                    sidebarButton.classList.add("text-fg-primary");
                }
            });

            querySelectorAll("button svg", sidebarAreaElement).forEach(svg => {
                const btn = svg.closest("button");
                if (btn) {
                    const active = btn.getAttribute("aria-selected") === "true";
                    if (active) {
                        svg.classList.add("text-primary");
                        svg.classList.remove("text-secondary", "group-hover:text-primary");
                    } else {
                        svg.classList.add("text-secondary", "group-hover:text-primary");
                        svg.classList.remove("text-primary");
                    }
                }
            });
        };

        sidebarAreaElement.addEventListener("click", handleTabClick);
        return () => sidebarAreaElement.removeEventListener("click", handleTabClick);
    }, [sidebarAreaElement]);

    useEffect(() => {
        if (!contentAreaElement) {
            return;
        }

        Array.from(contentAreaElement.children).forEach(childNode => {
            const childElement = childNode as HTMLElement;
            if (childElement.hasAttribute("data-grokness-panel")) {
                childElement.style.display = isTabActive ? "flex" : "none";
            } else {
                childElement.style.display = isTabActive ? "none" : "flex";
            }
        });
    }, [isTabActive, contentAreaElement]);

    useEffect(() => {
        if (!sidebarAreaElement) {
            return;
        }

        if (!querySelector("[data-grokness]", sidebarAreaElement)) {
            const tabButtonElement = document.createElement("button");
            tabButtonElement.setAttribute("data-grokness", "");
            tabButtonElement.setAttribute("aria-selected", "false");

            const baseClasses = ["inline-flex", "items-center", "gap-3", "px-4", "h-10", "rounded-xl"];
            tabButtonElement.classList.add(...baseClasses);

            const conditionalClasses = isTabActive
                ? ["text-primary", "bg-button-ghost-hover"]
                : ["text-fg-primary", "hover:bg-card-hover"];
            tabButtonElement.classList.add(...conditionalClasses);

            const iconSvgClasses = ["lucide", "lucide-user"];
            const iconColorClass = isTabActive ? "text-primary" : "text-secondary group-hover:text-primary";
            iconSvgClasses.push(iconColorClass);

            const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svgElement.classList.add(...iconSvgClasses);

            const textContentNode = document.createTextNode("Grokness");

            tabButtonElement.appendChild(svgElement);
            tabButtonElement.appendChild(textContentNode);

            sidebarAreaElement.appendChild(tabButtonElement);
        }
    }, [sidebarAreaElement, isTabActive]);

    return {
        isActive: isTabActive,
        contentContainer: contentAreaElement,
        sidebarContainer: sidebarAreaElement,
    };
};
