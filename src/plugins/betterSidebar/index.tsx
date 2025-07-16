/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokAPI } from "@api/api";
import { getBestSubscriptionTier, getFriendlyPlanName } from "@api/interfaces";
import styles from "@plugins/betterSidebar/styles.css?raw";
import { Devs } from "@utils/constants";
import { injectStyles, MutationObserverManager, querySelector, waitForElementByConfig } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

const logger = new Logger("BetterSidebar", "#f2d5cf");

const SIDEBAR_FOOTER_SELECTOR = '[data-sidebar="footer"]';
const AVATAR_BUTTON_SELECTOR = `${SIDEBAR_FOOTER_SELECTOR} .absolute button[aria-haspopup="menu"]`;
const TOGGLE_ICON_SELECTOR = '[data-sidebar="trigger"] svg';

const USER_CONTAINER_CLASS = "sidebar-user-info";

let cachedUserPlanData: { name: string; plan: string; } | null = null;

async function fetchUserPlanData(): Promise<{ name: string; plan: string; } | null> {
    if (cachedUserPlanData) {
        return cachedUserPlanData;
    }

    try {
        const user = await grokAPI.auth.getUser();
        const name = (`${user.givenName ?? ""} ${user.familyName ?? ""}`.trim() || (user.email?.split("@")[0] ?? "Unknown User"));
        const subscriptions = await grokAPI.subscriptions.getSubscriptions();
        const tier = getBestSubscriptionTier(subscriptions);
        const plan = getFriendlyPlanName(tier);
        cachedUserPlanData = { name, plan };
        return cachedUserPlanData;
    } catch (error) {
        logger.error("Failed to fetch user plan data:", error);
        return null;
    }
}

function useIsSidebarCollapsed(): boolean {
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        try {
            const toggleIcon = querySelector(TOGGLE_ICON_SELECTOR);
            if (!toggleIcon) {
                logger.warn("Toggle icon not found for sidebar collapse detection");
                return;
            }

            const updateState = () => setIsCollapsed(!toggleIcon.classList.contains("rotate-180"));

            updateState();

            const observer = new MutationObserver(updateState);
            observer.observe(toggleIcon, { attributes: true, attributeFilter: ["class"] });

            return () => observer.disconnect();
        } catch (error) {
            logger.error("Error in useIsSidebarCollapsed hook:", error);
            return () => { };
        }
    }, []);

    return isCollapsed;
}

function SidebarUserInfo() {
    const [userPlanData, setUserPlanData] = useState<{ name: string; plan: string; } | null>(null);
    const isCollapsed = useIsSidebarCollapsed();

    useEffect(() => {
        fetchUserPlanData().then(data => {
            if (!data) {
                logger.warn("User plan data not available");
            }
            setUserPlanData(data);
        });
    }, []);

    if (!userPlanData || isCollapsed) {
        return null;
    }

    return (
        <>
            <div className="display-name">{userPlanData.name}</div>
            <div className="plan text-secondary truncate">{userPlanData.plan}</div>
        </>
    );
}

const betterSidebarPatch: IPatch = (() => {
    let userInfoRoot: Root | null = null;
    let userInfoContainer: HTMLDivElement | null = null;
    let footerObserverDisconnect: (() => void) | null = null;
    let styleManager: { cleanup: () => void; } | null = null;

    function mountUserInfo(footer: HTMLElement) {
        try {
            const avatarButton = querySelector(AVATAR_BUTTON_SELECTOR, footer);
            if (!avatarButton) {
                logger.warn("Avatar button not found in sidebar footer");
                return;
            }

            if (userInfoContainer && avatarButton.parentElement?.contains(userInfoContainer)) {
                return;
            }

            unmountUserInfo();
            userInfoContainer = document.createElement("div");
            userInfoContainer.className = USER_CONTAINER_CLASS;
            avatarButton.parentElement?.insertBefore(userInfoContainer, avatarButton.nextSibling);
            userInfoRoot = createRoot(userInfoContainer);
            userInfoRoot.render(<SidebarUserInfo />);
        } catch (error) {
            logger.error("Error mounting user info:", error);
        }
    }

    function unmountUserInfo() {
        try {
            userInfoRoot?.unmount();
            userInfoContainer?.remove();
            userInfoRoot = null;
            userInfoContainer = null;
        } catch (error) {
            logger.error("Error unmounting user info:", error);
        }
    }

    return {
        apply() {
            try {
                styleManager = injectStyles(styles, "better-sidebar-styles");

                (async () => {
                    try {
                        const footer = await waitForElementByConfig({ selector: SIDEBAR_FOOTER_SELECTOR });
                        mountUserInfo(footer);

                        const observerManager = new MutationObserverManager();
                        const { observe, disconnect } = observerManager.createDebouncedObserver({
                            target: footer,
                            options: { childList: true, subtree: true },
                            callback: () => mountUserInfo(footer),
                            debounceDelay: 100,
                        });
                        observe();
                        footerObserverDisconnect = disconnect;
                    } catch (error) {
                        logger.error("Error setting up sidebar footer observer:", error);
                    }
                })();
            } catch (error) {
                logger.error("Error applying better sidebar patch:", error);
            }
        },
        remove() {
            try {
                footerObserverDisconnect?.();
                unmountUserInfo();
                styleManager?.cleanup();
            } catch (error) {
                logger.error("Error removing better sidebar patch:", error);
            }
        },
    };
})();

export default definePlugin({
    name: "Better Sidebar",
    description: "Enhances the sidebar by adding user information.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["sidebar", "user-info"],
    patches: [betterSidebarPatch],
});
