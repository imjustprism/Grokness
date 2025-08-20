/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokApi } from "@api/index";
import { Badge } from "@components/Badge";
import { Text } from "@components/Text";
import { Toast, type ToastIntent, ToastProvider } from "@components/Toast";
import styles from "@plugins/betterSidebar/styles.css?raw";
import { Devs } from "@utils/constants";
import { makeDraggable, makeDropTarget } from "@utils/dnd";
import { liveElements, selectOne, waitFor, wrapElement } from "@utils/dom";
import { createEventGuard } from "@utils/guard";
import { LOCATORS } from "@utils/locators";
import { Logger } from "@utils/logger";
import { session } from "@utils/storage";
import definePlugin, {
    definePluginSettings,
    type InjectedComponentProps,
    onPluginSettingsUpdated,
    Patch,
} from "@utils/types";
import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

const logger = new Logger("BetterSidebar", "#f2d5cf");

const {
    SIDEBAR_FOOTER_SELECTOR,
    AVATAR_BUTTON_SELECTOR,
    TOGGLE_ICON_SELECTOR,
    SIDEBAR_CONTAINER_SELECTOR,
    TOGGLE_BUTTON_SELECTOR,
    CHAT_LINK_SELECTOR,
    PROJECT_LINK_SELECTOR,
} = {
    SIDEBAR_FOOTER_SELECTOR: LOCATORS.SIDEBAR.footer,
    AVATAR_BUTTON_SELECTOR: LOCATORS.SIDEBAR.avatarButton,
    TOGGLE_ICON_SELECTOR: LOCATORS.SIDEBAR.toggleIcon,
    SIDEBAR_CONTAINER_SELECTOR: LOCATORS.SIDEBAR.container.selector,
    TOGGLE_BUTTON_SELECTOR: LOCATORS.SIDEBAR.toggleButton.selector,
    CHAT_LINK_SELECTOR: `${LOCATORS.SIDEBAR.container.selector} a[href^="/chat/"]` as const,
    PROJECT_LINK_SELECTOR: `${LOCATORS.SIDEBAR.container.selector} a[href^="/project/"]` as const,
};

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

const USER_INFO_CACHE_KEY = "sidebar:userInfo";
const USER_INFO_CACHE_TTL_MS = 5 * 60 * 1000;

async function getUserPlan(): Promise<{ name: string; plan: string; }> {
    const cached = session.get<{ name: string; plan: string; }>(USER_INFO_CACHE_KEY);
    if (cached) {
        return cached;
    }
    try {
        const { name, plan } = await grokApi.getUserPlanSummary();
        const data = { name, plan };
        session.set(USER_INFO_CACHE_KEY, data, USER_INFO_CACHE_TTL_MS);
        return data;
    } catch (e) {
        logger.error("fetch failed:", e);
        return { name: DEFAULT_USER_NAME, plan: DEFAULT_PLAN };
    }
}

function useCollapsed(root: HTMLElement | null): boolean {
    const [isCollapsed, set] = useState(false);
    useEffect(() => {
        if (!root) {
            return;
        }
        const icon = selectOne(TOGGLE_ICON_SELECTOR, root);
        if (!icon) {
            return;
        }
        const update = () => set(!icon.classList.contains("rotate-180"));
        update();
        const mo = new MutationObserver(update);
        mo.observe(icon, { attributes: true, attributeFilter: ["class"] });
        return () => mo.disconnect();
    }, [root]);
    return isCollapsed;
}

function SidebarUserInfo({ rootElement }: InjectedComponentProps) {
    const [data, setData] = useState<{ name: string; plan: string; } | null>(null);
    const [remainingDays, setRemainingDays] = useState<number | null>(null);
    const [showRemaining, setShowRemaining] = useState<boolean>(() => Boolean(settings.store.showRemainingTime));
    const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(() => (settings.store.billingCycle as "monthly" | "annual") || "monthly");
    const collapsed = useCollapsed(rootElement ?? null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        getUserPlan().then(setData);
    }, []);

    useEffect(() => {
        const off = onPluginSettingsUpdated("better-sidebar", ({ key, value }) => {
            if (key === "showRemainingTime") {
                setShowRemaining(Boolean(value));
            }
            if (key === "billingCycle") {
                const v = String(value) === "annual" ? "annual" : "monthly";
                setBillingCycle(v);
            }
        });
        return off;
    }, []);

    useEffect(() => {
        let aborted = false;
        const ac = new AbortController();
        const now = new Date();
        const parseIso = (s?: unknown): Date | null => {
            if (!s || typeof s !== "string") {
                return null;
            }
            const d = new Date(s);
            return isNaN(d.getTime()) ? null : d;
        };
        const addMonths = (d: Date, n: number): Date => {
            const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
            nd.setUTCMonth(nd.getUTCMonth() + n);
            return nd;
        };
        const addYears = (d: Date, n: number): Date => new Date(Date.UTC(d.getUTCFullYear() + n, d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
        const diffDaysCeil = (a: Date, b: Date): number => Math.max(0, Math.ceil((a.getTime() - b.getTime()) / 86400000));
        const compute = async () => {
            try {
                const subs = await grokApi.services.subscriptions.get({}, ac.signal);
                const list = Array.isArray((subs as unknown as { subscriptions?: unknown; }).subscriptions)
                    ? ((subs as unknown as { subscriptions: Array<Record<string, unknown>>; }).subscriptions)
                    : [];
                if (!list.length) {
                    setRemainingDays(null);
                    return;
                }
                const active = list
                    .filter(x => String((x.status as string) ?? "").toUpperCase().includes("ACTIVE"))
                    .sort((a, b) => {
                        const am = parseIso(a.modTime)?.getTime() ?? 0;
                        const bm = parseIso(b.modTime)?.getTime() ?? 0;
                        return bm - am;
                    })[0] ?? list.sort((a, b) => {
                        const acT = parseIso(a.createTime)?.getTime() ?? 0;
                        const bcT = parseIso(b.createTime)?.getTime() ?? 0;
                        return bcT - acT;
                    })[0];
                const start = parseIso(active?.createTime) ?? parseIso(active?.modTime);
                if (!start) {
                    setRemainingDays(null);
                    return;
                }
                let next: Date = start;
                if (billingCycle === "annual") {
                    while (next <= now) {
                        next = addYears(next, 1);
                    }
                } else {
                    while (next <= now) {
                        next = addMonths(next, 1);
                    }
                }
                if (aborted) {
                    return;
                }
                setRemainingDays(diffDaysCeil(next, now));
            } catch (e) {
                if (!ac.signal.aborted) {
                    logger.error("Failed to compute remaining subscription time:", e);
                }
                setRemainingDays(null);
            }
        };
        compute();
        return () => {
            aborted = true;
            ac.abort();
        };
    }, [billingCycle]);

    useEffect(() => {
        if (!data || !rootElement) {
            return;
        }
        const el = containerRef.current;
        if (!el) {
            return;
        }

        const avatarBtn = selectOne<HTMLButtonElement>(AVATAR_BUTTON_SELECTOR, rootElement);
        if (!avatarBtn) {
            return;
        }

        const cleanupOldWrappers = () => {
            document.querySelectorAll('[data-grokness-avatar-wrap="true"]').forEach(wrapper => {
                const parent = wrapper.parentElement;
                const avatar = wrapper.querySelector(AVATAR_BUTTON_SELECTOR as string);
                if (parent && avatar) {
                    parent.insertBefore(avatar, wrapper);
                }
                wrapper.remove();
            });
        };
        cleanupOldWrappers();

        const wrapper = wrapElement(avatarBtn, "div");
        wrapper.setAttribute("data-grokness-avatar-wrap", "true");
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.gap = "0.5px";
        wrapper.appendChild(el);

        return () => {
            el.remove();
            if (document.body.contains(wrapper)) {
                const parent = wrapper.parentElement;
                if (avatarBtn && parent) {
                    parent.insertBefore(avatarBtn, wrapper);
                    wrapper.remove();
                }
            }
        };
    }, [data, rootElement]);

    if (!data) {
        return null;
    }

    return (
        <div ref={containerRef} className={clsx("sidebar-user-info", collapsed && "is-collapsed")}>
            <Text as="span" className="display-name">{data.name}</Text>
            <div className="plan truncate flex items-center gap-1.5 text-xs leading-4">
                <Text as="span" tone="secondary" inheritSize className="truncate">{data.plan}</Text>
                {showRemaining && remainingDays != null && (
                    <Badge title="Remaining days" size="inherit" className="ml-1 text-xs leading-4">
                        {remainingDays}d
                    </Badge>
                )}
            </div>
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
        default: false,
    },
    collapseOnLoad: {
        type: "boolean",
        displayName: "Start collapsed",
        description: "Always load the site with the sidebar collapsed.",
        default: false,
    },
    showRemainingTime: {
        type: "boolean",
        displayName: "Show remaining time",
        description: "Display a badge with remaining days next to the plan.",
        default: false,
    },
    billingCycle: {
        type: "select",
        displayName: "Billing cycle",
        description: "Choose how to calculate remaining time (monthly or annual).",
        default: "monthly",
        options: [
            { label: "Monthly", value: "monthly" },
            { label: "Annual", value: "annual" },
        ],
    },
});

const CLASS_DROP_OVER = "grokness-project-drop-over" as const;

function showToast(message: React.ReactNode, intent: ToastIntent = "default", duration?: number): void {
    const event = new CustomEvent("grokness-toast", { detail: { message, intent, duration } });
    window.dispatchEvent(event);
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

const ToastHost: React.FC = () => {
    const [items, setItems] = useState<Array<{ id: number; message: React.ReactNode; intent?: ToastIntent; duration?: number; }>>([]);

    useEffect(() => {
        const handler = (e: CustomEvent) => {
            const id = Date.now() + Math.random();
            setItems(prev => [...prev, { id, ...e.detail }]);
        };
        window.addEventListener("grokness-toast", handler as EventListener);
        return () => window.removeEventListener("grokness-toast", handler as EventListener);
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

const BetterSidebar: React.FC<InjectedComponentProps> = ({ rootElement }) => {
    const sidebar = rootElement;

    useEffect(() => {
        if (!sidebar) {
            return;
        }

        const guard = createEventGuard({
            query: { roots: [sidebar], selectors: ["*"], filter: (node: HTMLElement) => node === sidebar },
            behavior: {
                events: ["click"],
                capture: true,
                passive: false,
                stopPropagation: "stopImmediate",
                preventDefault: "never",
                allowIfClosest: [TOGGLE_BUTTON_SELECTOR],
                allowPredicate: (event: Event) => {
                    const t = event.target as HTMLElement | null;
                    return !!t?.closest(INTERACTIVE_SELECTORS);
                },
            },
            debugName: "BetterSidebar:CollapseGuard",
        });

        const sync = () => {
            if (settings.store.collapseOnlyViaToggle) {
                sidebar.setAttribute("data-grokness-sidebar-nohover", "true");
                guard.enable();
            } else {
                sidebar.removeAttribute("data-grokness-sidebar-nohover");
                guard.disable();
            }
        };

        sync();
        const off = onPluginSettingsUpdated("better-sidebar", sync);
        return () => {
            off();
            guard.disable();
            sidebar.removeAttribute("data-grokness-sidebar-nohover");
        };
    }, [sidebar]);

    useEffect(() => {
        if (!sidebar) {
            return;
        }

        const dndBindings = new WeakMap<HTMLElement, { destroy: () => void; }>();

        const attachDrag = (el: HTMLAnchorElement) => {
            if (dndBindings.has(el)) {
                return;
            }
            const binding = makeDraggable(el, {
                getPayload: () => {
                    const id = extractConversationIdFromURL(el.href);
                    return id ? { "application/grokness-conversation": id } : null;
                },
                onDragStart: () => el.classList.add("grokness-chat-dragging"),
                onDragEnd: () => el.classList.remove("grokness-chat-dragging"),
            });
            dndBindings.set(el, binding);
        };

        const attachDrop = (el: HTMLAnchorElement) => {
            if (dndBindings.has(el)) {
                return;
            }
            const binding = makeDropTarget<{ conversationId: string; }>(el, {
                canAccept: types => types.has("application/grokness-conversation"),
                extract: data => {
                    const id = data.getData("application/grokness-conversation");
                    return id ? { conversationId: id } : null;
                },
                onEnter: () => el.classList.add(CLASS_DROP_OVER),
                onLeave: () => el.classList.remove(CLASS_DROP_OVER),
                onDrop: async ({ conversationId }) => {
                    const workspaceId = extractWorkspaceIdFromURL(el.href);
                    if (!workspaceId) {
                        return;
                    }
                    try {
                        await grokApi.services.workspaces.addConversation({ workspaceId }, { conversationId });
                        showToast("Chat added to project.", "success");
                    } catch (err) {
                        logger.error("Failed to add conversation to project:", err);
                        showToast("Failed to add chat to project.", "error");
                    }
                },
            });
            dndBindings.set(el, binding);
        };

        const detach = (el: HTMLElement) => dndBindings.get(el)?.destroy();

        let liveChats: ReturnType<typeof liveElements> | null = null;
        let liveProjects: ReturnType<typeof liveElements> | null = null;

        if (settings.store.dragToProject) {
            liveChats = liveElements(CHAT_LINK_SELECTOR, sidebar, attachDrag, detach, { debounce: 0 });
            liveProjects = liveElements(PROJECT_LINK_SELECTOR, sidebar, attachDrop, detach, { debounce: 0 });
        }

        return () => {
            liveChats?.disconnect();
            liveProjects?.disconnect();
        };
    }, [sidebar, settings.store.dragToProject]);

    useEffect(() => {
        if (!sidebar || !settings.store.collapseOnLoad) {
            return;
        }
        let didForce = false;
        const tryCollapse = async () => {
            if (didForce) {
                return;
            }
            try {
                await waitFor(TOGGLE_ICON_SELECTOR, { root: sidebar });
                if (!useCollapsed(sidebar)) {
                    selectOne<HTMLButtonElement>(TOGGLE_BUTTON_SELECTOR, sidebar)?.click();
                }
            } finally {
                didForce = true;
            }
        };
        tryCollapse();
    }, [sidebar]);

    return null;
};
export default definePlugin({
    name: "Better Sidebar",
    description: "General enhancements for the sidebar.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["sidebar"],
    settings,
    styles,
    patches: [
        Patch.ui("body")
            .component(ToastHost)
            .when(body => !body.querySelector("[data-grokness-toast-host]"))
            .build(),
        Patch.ui(SIDEBAR_FOOTER_SELECTOR)
            .component(SidebarUserInfo)
            .build(),
        Patch.ui(SIDEBAR_CONTAINER_SELECTOR)
            .component(BetterSidebar)
            .build(),
    ],
});
