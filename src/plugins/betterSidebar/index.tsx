/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApiClient, createApiServices, isActiveSubscription, normalizeTier, Tier } from "@api/index";
import styles from "@plugins/betterSidebar/styles.css?raw";
import { Devs } from "@utils/constants";
import { selectOne, wrapElement } from "@utils/dom";
import { LOCATORS } from "@utils/locators";
import { Logger } from "@utils/logger";
import definePlugin, { Patch } from "@utils/types";
import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

const logger = new Logger("BetterSidebar", "#f2d5cf");

const SIDEBAR_FOOTER_SELECTOR = LOCATORS.SIDEBAR.footer;
const AVATAR_BUTTON_SELECTOR = LOCATORS.SIDEBAR.avatarButton;
const TOGGLE_ICON_SELECTOR = LOCATORS.SIDEBAR.toggleIcon;

const DEFAULT_USER_NAME = "User";
const DEFAULT_PLAN = "Free";

const api = ApiClient.fromWindow();
const apiServices = createApiServices(api);

type MinimalUser = {
    givenName?: string | null;
    familyName?: string | null;
    email?: string | null;
    xSubscriptionType?: string | null;
};

type SubscriptionLike = {
    tier?: unknown;
    status?: unknown;
    enterprise?: boolean | null;
};

const normalizeSubs = (raw: unknown): ReadonlyArray<SubscriptionLike> => {
    if (Array.isArray(raw)) {
        return raw as ReadonlyArray<SubscriptionLike>;
    }
    if (raw && typeof raw === "object") {
        const o = raw as Record<string, unknown>;
        if (Array.isArray(o.subscriptions)) {
            return o.subscriptions as ReadonlyArray<SubscriptionLike>;
        }
        return [raw as SubscriptionLike];
    }
    return [];
};

const computePlan = (user: MinimalUser, subs: ReadonlyArray<SubscriptionLike>): string => {
    const isSuperGrokProUser = subs.some(s => normalizeTier(s.tier) === Tier.SuperGrokPro && isActiveSubscription(s.status));
    const isSuperGrokUser = subs.some(s => normalizeTier(s.tier) === Tier.GrokPro && isActiveSubscription(s.status));
    const isEnterpriseUser = subs.some(s => !!s.enterprise && isActiveSubscription(s.status));
    const isXPremiumPlus = (user.xSubscriptionType ?? "").trim() === "PremiumPlus";

    if (isSuperGrokProUser) {
        return "SuperGrok Pro";
    }
    if (isSuperGrokUser || isXPremiumPlus) {
        return "SuperGrok";
    }
    if (isEnterpriseUser) {
        return "Enterprise";
    }
    return DEFAULT_PLAN;
};

let cached: { name: string; plan: string; } | null = null;

async function getUserPlan(): Promise<{ name: string; plan: string; }> {
    if (cached) {
        return cached;
    }
    try {
        const [userRaw, subsRaw] = await Promise.all([apiServices.auth.getUser(), apiServices.subscriptions.get()]);
        const user = userRaw as MinimalUser;
        const subs = normalizeSubs(subsRaw);
        const name = (`${user.givenName ?? ""} ${user.familyName ?? ""}`.trim() || user.email?.split("@")[0] || DEFAULT_USER_NAME);
        const plan = computePlan(user, subs);
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
        const footer = el?.closest(LOCATORS.SIDEBAR.footer as unknown as string) as HTMLElement | null;
        if (!el || !footer) {
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
            wrapper.style.gap = "0.5px";
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

export default definePlugin({
    name: "Better Sidebar",
    description: "Enhances the sidebar by adding user information.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["sidebar", "user-info"],
    styles,
    patches: [
        Patch.ui(SIDEBAR_FOOTER_SELECTOR)
            .component(SidebarUserInfo)
            .parent(footer => selectOne(AVATAR_BUTTON_SELECTOR, footer)?.parentElement ?? footer)
            .after(AVATAR_BUTTON_SELECTOR as unknown as string)
            .debounce(50)
            .build(),
    ],
});
