/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    ApiClient,
    createApiServices,
    isActiveSubscription,
    normalizeTier,
    Tier
} from "@api/index";
import styles from "@plugins/betterSidebar/styles.css?raw";
import { Devs } from "@utils/constants";
import { querySelector } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPluginUIPatch } from "@utils/types";
import React, { useEffect, useState } from "react";

const logger = new Logger("BetterSidebar", "#f2d5cf");

const SIDEBAR_FOOTER_SELECTOR = '[data-sidebar="footer"]';
const AVATAR_BUTTON_SELECTOR = 'button[aria-haspopup="menu"]';
const TOGGLE_ICON_SELECTOR = '[data-sidebar="trigger"] svg';

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
        const icon = querySelector(TOGGLE_ICON_SELECTOR);
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
    useEffect(() => {
        getUserPlan().then(setData);
    }, []);
    if (!data || collapsed) {
        return null;
    }
    return (
        <div className="sidebar-user-info">
            <div className="display-name">{data.name}</div>
            <div className="plan text-secondary truncate">{data.plan}</div>
        </div>
    );
}

const patch: IPluginUIPatch = {
    component: SidebarUserInfo,
    target: SIDEBAR_FOOTER_SELECTOR,
    getTargetParent: footer => footer.querySelector(`${AVATAR_BUTTON_SELECTOR}`)?.parentElement ?? footer,
    referenceNode: parent => parent.querySelector(AVATAR_BUTTON_SELECTOR)?.nextSibling ?? null
};

export default definePlugin({
    name: "Better Sidebar",
    description: "Enhances the sidebar by adding user information.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["sidebar", "user-info"],
    styles,
    patches: [patch]
});
