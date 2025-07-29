/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokAPI } from "@api/api";
import { getBestSubscriptionTier, getFriendlyPlanName } from "@api/interfaces";
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

let cachedUserPlanData: { name: string; plan: string; } | null = null;

async function fetchUserPlanData(): Promise<{ name: string; plan: string; }> {
    if (cachedUserPlanData) {
        return cachedUserPlanData;
    }

    try {
        const user = await grokAPI.auth.getUser();
        const subscriptions = await grokAPI.subscriptions.getSubscriptions();
        const tier = getBestSubscriptionTier(subscriptions);

        const name = (`${user.givenName ?? ""} ${user.familyName ?? ""}`.trim() || user.email?.split("@")[0] || DEFAULT_USER_NAME);
        const plan = getFriendlyPlanName(tier);

        cachedUserPlanData = { name, plan };
        return cachedUserPlanData;
    } catch (error) {
        logger.error("Failed to fetch user plan data:", error);
        return { name: DEFAULT_USER_NAME, plan: DEFAULT_PLAN };
    }
}

function useIsSidebarCollapsed(): boolean {
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        const toggleIcon = querySelector(TOGGLE_ICON_SELECTOR);
        if (!toggleIcon) {
            logger.warn("Sidebar toggle icon not found.");
            return;
        }

        const updateCollapseState = () => {
            setIsCollapsed(!toggleIcon.classList.contains("rotate-180"));
        };

        updateCollapseState();
        const observer = new MutationObserver(updateCollapseState);
        observer.observe(toggleIcon, { attributes: true, attributeFilter: ["class"] });

        return () => observer.disconnect();
    }, []);

    return isCollapsed;
}

function SidebarUserInfo() {
    const [userPlanData, setUserPlanData] = useState<{ name: string; plan: string; } | null>(null);
    const isCollapsed = useIsSidebarCollapsed();

    useEffect(() => {
        fetchUserPlanData().then(setUserPlanData);
    }, []);

    if (!userPlanData || isCollapsed) {
        return null;
    }

    return (
        <div className="sidebar-user-info">
            <div className="display-name">{userPlanData.name}</div>
            <div className="plan text-secondary truncate">{userPlanData.plan}</div>
        </div>
    );
}

const betterSidebarPatch: IPluginUIPatch = {
    component: SidebarUserInfo,
    target: {
        selector: SIDEBAR_FOOTER_SELECTOR,
    },
    getTargetParent: footerElement =>
        footerElement.querySelector(`${AVATAR_BUTTON_SELECTOR}`)?.parentElement ?? footerElement,

    referenceNode: parentElement =>
        parentElement.querySelector(AVATAR_BUTTON_SELECTOR)?.nextSibling ?? null,
};

export default definePlugin({
    name: "Better Sidebar",
    description: "Enhances the sidebar by adding user information.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["sidebar", "user-info"],
    styles,
    patches: [betterSidebarPatch],
});
