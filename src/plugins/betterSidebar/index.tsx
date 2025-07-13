/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokAPI } from "@api/api";
import { getBestSubscriptionTier, getFriendlyPlanName } from "@api/interfaces";
import styles from "@plugins/betterSidebar/styles.css?raw";
import { Devs } from "@utils/constants";
import { waitForElementAppearance } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

const logger = new Logger("BetterSidebar", "#f2d5cf");

interface UserPlanData {
    name: string;
    plan: string;
}

let cachedUserPlanData: UserPlanData | null = null;

async function fetchUserPlanData(): Promise<UserPlanData | null> {
    if (cachedUserPlanData) {
        return cachedUserPlanData;
    }

    try {
        const user = await grokAPI.auth.getUser();
        const name = formatUserName(user);
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

function formatUserName(user: {
    givenName?: string;
    familyName?: string;
    email?: string;
}): string {
    if (user.givenName && user.familyName) {
        return `${user.givenName} ${user.familyName}`;
    }
    if (user.givenName) {
        return user.givenName;
    }
    if (user.familyName) {
        return user.familyName;
    }
    return user.email?.split("@")[0] ?? "Unknown User";
}

function useIsSidebarCollapsed(): boolean {
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        const checkSidebarState = () => {
            const toggleIcon = document.querySelector(
                '[data-sidebar="trigger"] svg'
            );
            if (!toggleIcon) {
                logger.warn("Sidebar toggle icon not found");
                return;
            }
            const isExpanded = toggleIcon.classList.contains("rotate-180");
            const collapsed = !isExpanded;
            setIsCollapsed(collapsed);
        };

        checkSidebarState();

        const toggleIcon = document.querySelector(
            '[data-sidebar="trigger"] svg'
        );
        if (!toggleIcon) {
            logger.warn("Sidebar toggle icon not found for observer");
            return;
        }

        const observer = new MutationObserver(checkSidebarState);
        observer.observe(toggleIcon, { attributes: true, attributeFilter: ["class"] });

        return () => {
            observer.disconnect();
        };
    }, []);

    return isCollapsed;
}

function SidebarUserInfo() {
    const [userPlanData, setUserPlanData] = useState<UserPlanData | null>(null);
    const isSidebarCollapsed = useIsSidebarCollapsed();

    useEffect(() => {
        fetchUserPlanData()
            .then(data => {
                setUserPlanData(data);
            })
            .catch(err => logger.error("Failed to fetch user plan data in component:", err));
    }, []);

    if (!userPlanData || isSidebarCollapsed) {
        return null;
    }

    return (
        <>
            <div className="display-name">{userPlanData.name}</div>
            <div className="plan text-secondary truncate">{userPlanData.plan}</div>
        </>
    );
}

const USER_CONTAINER_CLASS = "sidebar-user-info";

const betterSidebarPatch: IPatch = (() => {
    let sidebarObserver: MutationObserver | null = null;
    let userInfoRoot: Root | null = null;
    let userInfoContainer: HTMLDivElement | null = null;
    let styleElement: HTMLStyleElement | null = null;
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    let isUserInfoMounted = false;

    function mountUserInfo() {
        try {
            const avatarButton = document.querySelector<HTMLElement>(
                '[data-sidebar="footer"] .absolute button[aria-haspopup="menu"]'
            );
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
            avatarButton.parentElement?.insertBefore(
                userInfoContainer,
                avatarButton.nextSibling
            );
            userInfoRoot = createRoot(userInfoContainer);
            userInfoRoot.render(<SidebarUserInfo />);
        } catch (err) {
            logger.error("Failed to mount sidebar user info:", err);
        }
    }

    function unmountUserInfo() {
        try {
            if (userInfoRoot) {
                userInfoRoot.unmount();
                userInfoRoot = null;
            }
            if (userInfoContainer) {
                userInfoContainer.remove();
                userInfoContainer = null;
            }
        } catch (err) {
            logger.error("Failed to unmount sidebar user info:", err);
        }
    }

    function debouncedMount() {
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }
        debounceTimeout = setTimeout(() => {
            updateMounts();
        }, 100);
    }

    function updateMounts() {
        if (!isUserInfoMounted) {
            mountUserInfo();
            isUserInfoMounted = true;
        }
    }

    return {
        apply() {
            try {
                styleElement = document.createElement("style");
                styleElement.textContent = styles;
                document.head.appendChild(styleElement);

                waitForElementAppearance('[data-sidebar="footer"]').then((footer: HTMLElement) => {
                    updateMounts();

                    sidebarObserver = new MutationObserver(debouncedMount);
                    sidebarObserver.observe(footer, { childList: true, subtree: true });
                }).catch((err: unknown) => {
                    logger.error("Failed to find or observe sidebar footer:", err);
                });
            } catch (err) {
                logger.error("Failed to apply better sidebar patch:", err);
            }
        },
        remove() {
            try {
                sidebarObserver?.disconnect();
                sidebarObserver = null;

                if (debounceTimeout) {
                    clearTimeout(debounceTimeout);
                    debounceTimeout = null;
                }

                unmountUserInfo();
                isUserInfoMounted = false;

                styleElement?.remove();
                styleElement = null;
            } catch (err) {
                logger.error("Failed to remove better sidebar patch:", err);
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
