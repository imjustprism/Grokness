/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SettingsPanel } from "@plugins/_core/settingsUI/components/SettingsPanel";
import { SettingsTab } from "@plugins/_core/settingsUI/components/SettingsTab";
import { useSettingsLogic } from "@plugins/_core/settingsUI/hooks/useSettingsLogic";
import styles from "@plugins/_core/settingsUI/styles.css?raw";
import { Devs } from "@utils/constants";
import { selectOne } from "@utils/dom";
import { LOCATORS } from "@utils/locators";
import { definePlugin, type IPatch } from "@utils/types";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SettingsUIComponent: React.FC<{ rootElement?: HTMLElement; }> = ({ rootElement }) => {
    const [active, setActive] = useState(false);
    const logic = useSettingsLogic();

    if (!rootElement) {
        return null;
    }

    const dialogRoot = selectOne(LOCATORS.SETTINGS_MODAL.dialog, rootElement) ?? rootElement;
    const contentArea = selectOne(LOCATORS.SETTINGS_MODAL.contentArea, dialogRoot);
    const sidebarArea = selectOne(LOCATORS.SETTINGS_MODAL.leftNavContainer, dialogRoot);

    useEffect(() => {
        if (!sidebarArea) {
            return;
        }
        const onClick = (e: MouseEvent) => {
            const btn = (e.target as HTMLElement).closest("button");
            if (!btn || !sidebarArea.contains(btn)) {
                return;
            }
            const isGrokness = btn.hasAttribute("data-grokness-tab");
            setActive(isGrokness);
            sidebarArea.querySelectorAll("button").forEach(b => {
                const activeBtn = b === btn;
                b.setAttribute("aria-selected", String(activeBtn));
                if (b.hasAttribute("data-grokness-tab")) {
                    return;
                }
                if (activeBtn) {
                    b.classList.add("text-primary", "bg-button-ghost-hover");
                    b.classList.remove("text-fg-primary");
                } else {
                    b.classList.remove("text-primary", "bg-button-ghost-hover", "[&>svg]:text-primary");
                    b.classList.add("text-fg-primary");
                }
                const svg = b.querySelector("svg");
                if (svg) {
                    svg.classList.toggle("text-primary", activeBtn);
                    svg.classList.toggle("text-secondary", !activeBtn);
                }
            });
        };
        sidebarArea.addEventListener("click", onClick as EventListener);
        return () => sidebarArea.removeEventListener("click", onClick as EventListener);
    }, [sidebarArea]);

    useEffect(() => {
        if (!contentArea) {
            return;
        }
        Array.from(contentArea.children).forEach(n => {
            const el = n as HTMLElement;
            if (el.hasAttribute("data-grokness-panel")) {
                el.style.display = active ? "flex" : "none";
            } else {
                el.style.display = active ? "none" : "flex";
            }
        });
    }, [active, contentArea]);

    if (!contentArea || !sidebarArea) {
        return null;
    }

    return (
        <>
            {createPortal(<SettingsTab isActive={active} onClick={() => setActive(true)} />, sidebarArea)}
            {createPortal(<SettingsPanel isActive={active} {...logic} />, contentArea)}
        </>
    );
};

const settingsPatch: IPatch = {
    apply() { },
    remove() { },
};

export default definePlugin({
    name: "Settings UI",
    description: "Adds a settings panel to manage Grokness plugins.",
    authors: [Devs.Prism],
    required: true,
    hidden: true,
    category: "utility",
    tags: ["settings", "ui", "core"],
    styles,
    patches: [
        {
            component: SettingsUIComponent,
            target: 'div[role="dialog"][data-state="open"]',
            forEach: true,
            getTargetParent: el => el,
            referenceNode: () => null,
        },
        settingsPatch,
    ],
});
