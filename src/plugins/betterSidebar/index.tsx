/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokApi } from "@api/index";
import styles from "@plugins/betterSidebar/styles.css?raw";
import { Devs } from "@utils/constants";
import { liveElements, selectOne, waitFor, wrapElement } from "@utils/dom";
import { createEventGuard, type EventGuard } from "@utils/guard";
import { LOCATORS } from "@utils/locators";
import { Logger } from "@utils/logger";
import definePlugin, { definePluginSettings, onPluginSettingsUpdated, Patch } from "@utils/types";
import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

const logger = new Logger("BetterSidebar", "#f2d5cf");

const SIDEBAR_FOOTER_SELECTOR = LOCATORS.SIDEBAR.footer;
const AVATAR_BUTTON_SELECTOR = LOCATORS.SIDEBAR.avatarButton;
const TOGGLE_ICON_SELECTOR = LOCATORS.SIDEBAR.toggleIcon;
const SIDEBAR_CONTAINER_SELECTOR = LOCATORS.SIDEBAR.container.selector;
const TOGGLE_BUTTON_SELECTOR = LOCATORS.SIDEBAR.toggleButton.selector;

const INTERACTIVE_SELECTORS = [
    "a",
    "button",
    "input",
    "select",
    "textarea",
    '[role="button"]',
    '[role="link"]',
    '[contenteditable="true"]',
    '[data-sidebar="menu-button"]',
].join(",");

const DEFAULT_USER_NAME = "User";
const DEFAULT_PLAN = "Free";

let cached: { name: string; plan: string; } | null = null;

async function getUserPlan(): Promise<{ name: string; plan: string; }> {
    if (cached) {
        return cached;
    }
    try {
        const { name, plan } = await grokApi.getUserPlanSummary();
        cached = { name, plan };
        return cached;
    } catch (e) {
        logger.error("fetch failed:", e);
        return { name: DEFAULT_USER_NAME, plan: DEFAULT_PLAN };
    }
}

function useCollapsed(): boolean {
    const [isCollapsed, set] = useState(false);
    useEffect(() => {
        const icon = selectOne(TOGGLE_ICON_SELECTOR);
        if (!icon) {
            return;
        }
        const update = () => set(!icon.classList.contains("rotate-180"));
        update();
        const mo = new MutationObserver(update);
        mo.observe(icon, { attributes: true, attributeFilter: ["class"] });
        return () => mo.disconnect();
    }, []);
    return isCollapsed;
}

function SidebarUserInfo() {
    const [data, setData] = useState<{ name: string; plan: string; } | null>(null);
    const collapsed = useCollapsed();
    const containerRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        getUserPlan().then(setData);
    }, []);

    useEffect(() => {
        if (!data) {
            return;
        }
        const el = containerRef.current;
        if (!el) {
            return;
        }
        const footer = el.closest(LOCATORS.SIDEBAR.footer as unknown as string) as HTMLElement | null;
        if (!footer) {
            return;
        }
        const avatarBtn = selectOne<HTMLButtonElement>(AVATAR_BUTTON_SELECTOR, footer);
        if (!avatarBtn) {
            return;
        }
        let wrapper = avatarBtn.parentElement as HTMLElement | null;
        if (!wrapper) {
            return;
        }
        if (!wrapper.hasAttribute("data-grokness-avatar-wrap")) {
            wrapper = wrapElement(avatarBtn, "div");
            wrapper.setAttribute("data-grokness-avatar-wrap", "true");
            wrapper.style.display = "flex";
            wrapper.style.alignItems = "center";
            wrapper.style.gap = "6px";
        }
        if (el.parentElement !== wrapper) {
            wrapper.appendChild(el);
        }
    }, [data]);
    if (!data) {
        return null;
    }

    return (
        <div ref={containerRef} className={clsx("sidebar-user-info", collapsed && "is-collapsed")}>
            <div className="display-name">{data.name}</div>
            <div className="plan text-secondary truncate">{data.plan}</div>
        </div>
    );
}

const settings = definePluginSettings({
    collapseOnlyViaToggle: {
        type: "boolean",
        displayName: "Collapse only via toggle button",
        description: "Only collapse or expand the sidebar using its toggle button.",
        default: false,
    },
    collapseOnLoad: {
        type: "boolean",
        displayName: "Start collapsed",
        description: "Always load the site with the sidebar collapsed.",
        default: false,
    },
});

const GUARDS = new WeakMap<HTMLElement, EventGuard>();
let disconnectLive: (() => void) | null = null;
let offSettingsListener: (() => void) | null = null;
let didForceInitialCollapse = false;

function ensureGuard(el: HTMLElement): void {
    if (GUARDS.has(el)) {
        return;
    }
    const guard = createEventGuard({
        query: {
            roots: [el],
            selectors: ["*"],
            filter: node => node === el,
        },
        behavior: {
            events: ["click"],
            capture: true,
            passive: false,
            stopPropagation: "stopImmediate",
            preventDefault: "never",
            allowIfClosest: [TOGGLE_BUTTON_SELECTOR],
            allowPredicate: event => {
                const t = event.target as HTMLElement | null;
                if (!t) {
                    return true;
                }
                if (t.closest(TOGGLE_BUTTON_SELECTOR)) {
                    return true;
                }
                if (t.closest(INTERACTIVE_SELECTORS)) {
                    return true;
                }
                return false;
            },
        },
        debugName: "BetterSidebar:CollapseGuard",
    });
    guard.enable();
    GUARDS.set(el, guard);
}

function disableGuard(el: HTMLElement): void {
    const g = GUARDS.get(el);
    if (g) {
        g.disable();
        GUARDS.delete(el);
    }
}

function syncContainer(el: HTMLElement): void {
    if (settings.store.collapseOnlyViaToggle) {
        ensureGuard(el);
    } else {
        disableGuard(el);
    }

    if (settings.store.collapseOnlyViaToggle) {
        el.setAttribute("data-grokness-sidebar-nohover", "true");
    } else {
        el.removeAttribute("data-grokness-sidebar-nohover");
    }
}

function attachSidebar(el: HTMLElement): void {
    syncContainer(el);
}

function detachSidebar(el: HTMLElement): void {
    el.removeAttribute("data-grokness-sidebar-nohover");
    disableGuard(el);
}

function isCollapsedWithin(root?: ParentNode): boolean {
    const icon = selectOne<HTMLElement>(TOGGLE_ICON_SELECTOR, root);
    if (!icon) {
        return false;
    }
    return !icon.classList.contains("rotate-180");
}

async function tryForceCollapseOnce(root: HTMLElement | Document = document): Promise<void> {
    if (didForceInitialCollapse || !settings.store.collapseOnLoad) {
        return;
    }
    try {
        const container = await waitFor<HTMLElement>(LOCATORS.SIDEBAR.container, { root });
        await waitFor<HTMLElement>(TOGGLE_ICON_SELECTOR, { root: container });
        if (!isCollapsedWithin(container)) {
            const toggleBtn = selectOne<HTMLButtonElement>(LOCATORS.SIDEBAR.toggleButton, container);
            toggleBtn?.click();
        }
    } catch {
        // ignore timing issues
    } finally {
        didForceInitialCollapse = true;
    }
}

export default definePlugin({
    name: "Better Sidebar",
    description: "General enhancements for the sidebar.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["sidebar"],
    settings,
    styles,
    patches: [
        (() => {
            const patch = Patch.ui(SIDEBAR_FOOTER_SELECTOR)
                .component(SidebarUserInfo)
                .parent(footer => selectOne(AVATAR_BUTTON_SELECTOR, footer)?.parentElement ?? footer)
                .after(AVATAR_BUTTON_SELECTOR as unknown as string)
                .when(footer => !footer.querySelector('[data-grokness-ui="better-sidebar"]'))
                .debounce(50)
                .build();
            return Object.assign(patch, {
                disconnect: () => {
                    document.querySelectorAll('[data-grokness-avatar-wrap="true"]').forEach(node => {
                        const wrap = node as HTMLElement;
                        const avatar = wrap.querySelector(AVATAR_BUTTON_SELECTOR as unknown as string);
                        const parent = wrap.parentElement;
                        if (avatar && parent) {
                            parent.insertBefore(avatar, wrap);
                            wrap.remove();
                        }
                    });
                }
            });
        })(),
    ],

    start() {
        const live = liveElements<HTMLElement>(SIDEBAR_CONTAINER_SELECTOR, document, attachSidebar, detachSidebar, { debounce: 50 });
        disconnectLive = live.disconnect;

        offSettingsListener = onPluginSettingsUpdated("better-sidebar", detail => {
            document.querySelectorAll<HTMLElement>(SIDEBAR_CONTAINER_SELECTOR).forEach(syncContainer);
            if (detail.key === "collapseOnLoad" && detail.value === true) {
                didForceInitialCollapse = false;
                void tryForceCollapseOnce(document);
            }
        });

        document.querySelectorAll<HTMLElement>(SIDEBAR_CONTAINER_SELECTOR).forEach(syncContainer);
        void tryForceCollapseOnce(document);
    },

    stop() {
        disconnectLive?.();
        disconnectLive = null;
        offSettingsListener?.();
        offSettingsListener = null;
        document.querySelectorAll<HTMLElement>(SIDEBAR_CONTAINER_SELECTOR).forEach(detachSidebar);
    },
});
