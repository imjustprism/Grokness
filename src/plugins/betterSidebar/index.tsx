/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokApi } from "@api/index";
import { Toast, type ToastIntent, ToastProvider } from "@components/Toast";
import styles from "@plugins/betterSidebar/styles.css?raw";
import { Devs } from "@utils/constants";
import { makeDraggable, makeDropTarget } from "@utils/dnd";
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
const CHAT_LINK_SELECTOR = `${SIDEBAR_CONTAINER_SELECTOR} a[href^="/chat/"]` as const;
const PROJECT_LINK_SELECTOR = `${SIDEBAR_CONTAINER_SELECTOR} a[href^="/project/"]` as const;

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
    dragToProject: {
        type: "boolean",
        displayName: "Drag chats into projects",
        description: "Enable drag-and-drop of chats onto projects to add them to a project.",
        default: true,
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
let disconnectLiveChats: (() => void) | null = null;
let disconnectLiveProjects: (() => void) | null = null;

const CLASS_DROP_OVER = "grokness-project-drop-over" as const;

let pushToastRef: ((t: {
    id: number;
    message: React.ReactNode;
    intent?: ToastIntent;
    duration?: number;
}) => void) | null = null;
const PENDING_TOASTS: Array<{
    id: number;
    message: React.ReactNode;
    intent?: ToastIntent;
    duration?: number;
}> = [];

const ToastHost: React.FC = () => {
    const [items, setItems] = React.useState<Array<{ id: number; message: React.ReactNode; intent?: ToastIntent; duration?: number; }>>([]);
    React.useEffect(() => {
        pushToastRef = t => setItems(prev => [...prev, t]);
        if (PENDING_TOASTS.length) {
            setItems(prev => [...prev, ...PENDING_TOASTS]);
            PENDING_TOASTS.length = 0;
        }
        return () => {
            pushToastRef = null;
        };
    }, []);
    return (
        <div data-grokness-toast-host>
            <ToastProvider duration={5000}>
                {items.map(item => (
                    <Toast
                        key={item.id}
                        open
                        onOpenChange={open => {
                            if (!open) {
                                setItems(prev => prev.filter(x => x.id !== item.id));
                            }
                        }}
                        intent={item.intent}
                        duration={item.duration}
                        message={item.message}
                    />
                ))}
            </ToastProvider>
        </div>
    );
};

function showToast(
    message: React.ReactNode,
    intent: ToastIntent = "default",
    duration?: number
): void {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    if (pushToastRef) {
        pushToastRef({ id, message, intent, duration });
    } else {
        PENDING_TOASTS.push({ id, message, intent, duration });
    }
}

function extractConversationIdFromURL(href: string | null): string | null {
    if (!href) {
        return null;
    }
    const match = href.match(/\/chat\/([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? null;
}

function extractWorkspaceIdFromURL(href: string | null): string | null {
    if (!href) {
        return null;
    }
    const match = href.match(/\/project\/([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? null;
}

const bindings = new WeakMap<HTMLElement, { destroy: () => void; }>();

function attachDragHandler(link: HTMLAnchorElement): void {
    if (bindings.has(link) || !settings.store.dragToProject) {
        return;
    }

    const binding = makeDraggable(link, {
        getPayload: () => {
            const conversationId = extractConversationIdFromURL(link.href);
            return conversationId
                ? { "application/grokness-conversation": conversationId }
                : null;
        },
        ghostScale: 0.8,
        cursorOffset: { x: -4, y: -4 },
        onDragStart: () => link.classList.add("grokness-chat-dragging"),
        onDragEnd: () => link.classList.remove("grokness-chat-dragging"),
    });

    bindings.set(link, binding);
}

function detachDragHandler(link: HTMLAnchorElement): void {
    bindings.get(link)?.destroy();
    bindings.delete(link);
}

function attachDropHandler(link: HTMLAnchorElement): void {
    if (bindings.has(link) || !settings.store.dragToProject) {
        return;
    }

    const binding = makeDropTarget<{ conversationId: string; }>(link, {
        canAccept: types => types.has("application/grokness-conversation"),
        extract: data => {
            const conversationId = data.getData("application/grokness-conversation");
            return conversationId ? { conversationId } : null;
        },
        onEnter: () => link.classList.add(CLASS_DROP_OVER),
        onOver: () => link.classList.add(CLASS_DROP_OVER),
        onLeave: () => link.classList.remove(CLASS_DROP_OVER),
        onDrop: async ({ conversationId }) => {
            const workspaceId = extractWorkspaceIdFromURL(link.href);
            if (!workspaceId) {
                return;
            }

            try {
                await grokApi.services.workspaces.addConversation(
                    { workspaceId },
                    { conversationId }
                );
                showToast("Chat added to project.", "success");
            } catch (err) {
                logger.error("Failed to add conversation to project:", err);
                showToast("Failed to add chat to project.", "error");
            } finally {
                link.classList.remove(CLASS_DROP_OVER);
            }
        },
    });

    bindings.set(link, binding);
}

function detachDropHandler(link: HTMLAnchorElement): void {
    bindings.get(link)?.destroy();
    bindings.delete(link);
}

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
            const patch = Patch.ui("body")
                .component(() => <ToastHost />)
                .forEach()
                .when(body => !body.querySelector('[data-grokness-ui="better-sidebar"] [data-grokness-toast-host]'))
                .debounce(50)
                .build();
            return patch;
        })(),
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

        const liveChats = liveElements<HTMLAnchorElement>(CHAT_LINK_SELECTOR, document, attachDragHandler, detachDragHandler, { debounce: 100 });
        disconnectLiveChats = liveChats.disconnect;
        const liveProjects = liveElements<HTMLAnchorElement>(PROJECT_LINK_SELECTOR, document, attachDropHandler, detachDropHandler, { debounce: 100 });
        disconnectLiveProjects = liveProjects.disconnect;
    },

    stop() {
        disconnectLive?.();
        disconnectLive = null;
        disconnectLiveChats?.();
        disconnectLiveChats = null;
        disconnectLiveProjects?.();
        disconnectLiveProjects = null;
        offSettingsListener?.();
        offSettingsListener = null;
        document.querySelectorAll<HTMLElement>(SIDEBAR_CONTAINER_SELECTOR).forEach(detachSidebar);
        document.querySelectorAll<HTMLAnchorElement>(CHAT_LINK_SELECTOR).forEach(detachDragHandler);
        document.querySelectorAll<HTMLAnchorElement>(PROJECT_LINK_SELECTOR).forEach(detachDropHandler);
        pushToastRef = null;
    },
});
