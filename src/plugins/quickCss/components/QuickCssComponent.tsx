/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { QuickCssPanel } from "@plugins/quickCss/components/QuickCssPanel";
import { QuickCssTab } from "@plugins/quickCss/components/QuickCssTab";
import { querySelector, querySelectorAll } from "@utils/dom";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const QuickCssComponent: React.FC<{ dialogElement: HTMLElement; }> = ({ dialogElement }) => {
    const [isActive, setIsActive] = useState(false);

    const contentContainer = querySelector('div[class*="flex-1"]', dialogElement) as HTMLElement | null;

    const sidebarContainer = contentContainer?.parentElement ? querySelector("div > div", contentContainer.parentElement) as HTMLElement | null : null;

    useEffect(() => {
        if (!sidebarContainer) {
            return;
        }

        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const button = target.closest("button");
            if (!button) {
                return;
            }

            const isQuickCss = button.hasAttribute("data-quickcss");

            setIsActive(isQuickCss);

            querySelectorAll("button", sidebarContainer).forEach(btn => {
                const active = btn === button;
                btn.setAttribute("aria-selected", active ? "true" : "false");
                if (active) {
                    btn.classList.add("text-primary", "bg-button-ghost-hover", "[&>svg]:text-primary");
                    btn.classList.remove("text-fg-primary");
                } else {
                    btn.classList.remove("text-primary", "bg-button-ghost-hover", "[&>svg]:text-primary");
                    btn.classList.add("text-fg-primary");
                }
            });

            querySelectorAll("button svg", sidebarContainer).forEach(svg => {
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

        sidebarContainer.addEventListener("click", handleClick);
        return () => sidebarContainer.removeEventListener("click", handleClick);
    }, [sidebarContainer]);

    useEffect(() => {
        if (!contentContainer) {
            return;
        }

        const quickPanel = contentContainer.querySelector("[data-quickcss-panel]") as HTMLElement | null;
        const grokPanel = contentContainer.querySelector("[data-grokness-panel]") as HTMLElement | null;

        if (quickPanel) {
            quickPanel.style.display = isActive ? "flex" : "none";
        }

        if (isActive) {
            if (grokPanel) {
                grokPanel.style.display = "none";
            }

            Array.from(contentContainer.children).forEach(child => {
                const el = child as HTMLElement;
                if (!el.hasAttribute("data-quickcss-panel") && !el.hasAttribute("data-grokness-panel")) {
                    el.style.display = "none";
                }
            });
        }
    }, [isActive, contentContainer]);

    if (!contentContainer || !sidebarContainer) {
        return null;
    }

    return (
        <>
            {createPortal(<QuickCssTab isActive={isActive} />, sidebarContainer)}
            {createPortal(<QuickCssPanel isActive={isActive} />, contentContainer)}
        </>
    );
};
