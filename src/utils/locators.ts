/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { AnySelector, ElementFinderConfig } from "@utils/dom";

export const LOCATORS = {
    COMMON: {
        buttonByText(text: string | RegExp): ElementFinderConfig {
            return {
                selector: "button",
                ...(typeof text === "string" ? { textIncludes: text } : { textMatches: text })
            } as ElementFinderConfig;
        },
        containerByClasses(...classes: string[]): ElementFinderConfig {
            return { selector: "div", classContains: classes } as ElementFinderConfig;
        },
    },
    SIDEBAR: {
        container: { selector: '[data-sidebar="sidebar"]' } as ElementFinderConfig,
        header: { selector: '[data-sidebar="header"]' } as ElementFinderConfig,
        homeLink: { selector: 'a[aria-label="Home page"]' } as ElementFinderConfig,
        content: { selector: '[data-sidebar="content"]' } as ElementFinderConfig,
        group: { selector: '[data-sidebar="group"]' } as ElementFinderConfig,
        menu: { selector: 'ul[data-sidebar="menu"]' } as ElementFinderConfig,
        menuItem: { selector: 'li[data-sidebar="menu-item"]' } as ElementFinderConfig,
        menuButton: { selector: '[data-sidebar="menu-button"]' } as ElementFinderConfig,
        menuIcon: { selector: '[data-sidebar="icon"]' } as ElementFinderConfig,

        searchButton: { selector: '[data-sidebar="menu-button"]', ariaLabel: "Search" } as ElementFinderConfig,
        voiceButton: { selector: '[data-sidebar="menu-button"]', ariaLabel: "Voice" } as ElementFinderConfig,
        filesLink: { selector: '[data-sidebar="menu-button"]', textIncludes: "Files" } as ElementFinderConfig,
        tasksLink: { selector: '[data-sidebar="menu-button"]', textIncludes: "Tasks" } as ElementFinderConfig,
        projectsLink: { selector: '[data-sidebar="menu-button"]', textIncludes: "Projects" } as ElementFinderConfig,
        historyButton: { selector: '[data-sidebar="menu-button"]', ariaLabel: "History" } as ElementFinderConfig,

        footer: "[data-sidebar=\"footer\"]" as AnySelector,
        avatarButton: "button[aria-haspopup=\"menu\"]" as AnySelector,
        toggleButton: { selector: 'button[data-sidebar="trigger"]' } as ElementFinderConfig,
        toggleIcon: "[data-sidebar=\"trigger\"] svg" as AnySelector,

        menuButtonByText(text: string): ElementFinderConfig {
            return { selector: '[data-sidebar="menu-button"]', textIncludes: text };
        },
        menuButtonByAria(label: string | RegExp): ElementFinderConfig {
            return { selector: '[data-sidebar="menu-button"]', ariaLabel: label } as ElementFinderConfig;
        },
        menuItemByText(text: string): ElementFinderConfig {
            return { selector: 'li[data-sidebar="menu-item"] [data-sidebar="menu-button"]', textIncludes: text };
        },
    },
    QUERY_BAR: {
        root: ".query-bar" as AnySelector,
        modelButton: { selector: "button[aria-label='Model select']" } as ElementFinderConfig,
        modelNameSpan: "span.font-semibold" as AnySelector,
        hiddenModelSelect: "select[aria-hidden='true']" as AnySelector,
        textarea: { selector: ".query-bar textarea" } as ElementFinderConfig,
        editor: { selector: ".tiptap.ProseMirror" } as ElementFinderConfig,
        editorParagraph: { selector: ".tiptap.ProseMirror p" } as ElementFinderConfig,
        editorPlaceholder: { selector: ".tiptap.ProseMirror p[data-placeholder]" } as ElementFinderConfig,
        editorPlaceholderDefault: {
            selector: ".tiptap.ProseMirror p[data-placeholder]",
            textIncludes: "What do you want to know?",
        } as ElementFinderConfig,
        editorPlaceholderChat: {
            selector: ".tiptap.ProseMirror p[data-placeholder]",
            textIncludes: "How can Grok help?",
        } as ElementFinderConfig,
        projectButton: { selector: "button", svgPartialD: "M3.33965 17L11.9999 22L20.6602 17V7" } as ElementFinderConfig,
        attachButton: { selector: "button[aria-label='Attach']" } as ElementFinderConfig,
        voiceModeButton: { selector: "button", ariaLabel: "Enter voice mode" } as ElementFinderConfig,
        thinkButton: { selector: "button[aria-label='Think']" } as ElementFinderConfig,
        deepSearchButton: { selector: "button[aria-label='DeeperSearch'],button[aria-label='DeepSearch']" } as ElementFinderConfig,

        buttonByAria(label: string | RegExp): ElementFinderConfig {
            return { selector: "button", ariaLabel: label } as ElementFinderConfig;
        },
        buttonWithSvgPath(pathD: string): ElementFinderConfig {
            return { selector: "button", svgPartialD: pathD } as ElementFinderConfig;
        },
        editorPlaceholderByText(text: string | RegExp): ElementFinderConfig {
            return { selector: ".tiptap.ProseMirror p[data-placeholder]", ...(typeof text === "string" ? { textIncludes: text } : { textMatches: text }) } as ElementFinderConfig;
        },
    },
    CHAT_NAV: {
        container: { selector: "div", classContains: ["absolute", "flex", "items-center", "ms-auto", "end-3"] } as ElementFinderConfig,
        homeLink: { selector: "a[href=\"/\"]" } as ElementFinderConfig,
        pinButton: { selector: "button", ariaLabel: "Pin" } as ElementFinderConfig,
        shareButton: { selector: "button", ariaLabel: "Share conversation" } as ElementFinderConfig,

        iconButtonByAria(label: string | RegExp): ElementFinderConfig {
            return { selector: "button", ariaLabel: label } as ElementFinderConfig;
        },
        anchorByHref(href: string | RegExp): ElementFinderConfig {
            return { selector: "a", ...(typeof href === "string" ? { filter: el => (el as HTMLAnchorElement).getAttribute("href") === href } : { filter: el => href.test((el as HTMLAnchorElement).getAttribute("href") ?? "") }) } as ElementFinderConfig;
        },
    },
    CHAT: {
        messageBubble: { selector: "div.message-bubble.bg-surface-l2" } as ElementFinderConfig,
        messageContainer: { selector: "div.relative.group" } as ElementFinderConfig,
        editButton: { selector: "button", ariaLabel: "Edit" } as ElementFinderConfig,
    },
    AVATAR_MENU: {
        wrapper: { selector: "[data-radix-popper-content-wrapper]" } as ElementFinderConfig,
        menu: { selector: '[data-radix-menu-content][role="menu"][data-state="open"]' } as ElementFinderConfig,
        menuItem: { selector: '[data-radix-menu-content][data-state="open"] [role="menuitem"]' } as ElementFinderConfig,

        settings: { selector: '[role="menuitem"]', textIncludes: "Settings" } as ElementFinderConfig,
        reportIssue: { selector: '[role="menuitem"]', textIncludes: "Report Issue" } as ElementFinderConfig,
        community: {
            selector: 'a[role="menuitem"]',
            filter: el => {
                const a = el as HTMLAnchorElement;
                const text = (a.textContent ?? "").trim();
                return text.includes("Community") || a.href.includes("discord.gg");
            },
        } as ElementFinderConfig,
        manageSubscription: { selector: '[role="menuitem"]', textIncludes: "Manage Subscription" } as ElementFinderConfig,
        signOut: { selector: '[role="menuitem"]', textIncludes: "Sign Out" } as ElementFinderConfig,

        itemByText(text: string | RegExp): ElementFinderConfig {
            return {
                selector: '[data-radix-menu-content][data-state="open"] [role="menuitem"]',
                ...(typeof text === "string" ? { textIncludes: text } : { textMatches: text })
            } as ElementFinderConfig;
        },
        menuByTriggerId(triggerId: string): ElementFinderConfig {
            return {
                selector: '[data-radix-menu-content][role="menu"]',
                filter: el => el.getAttribute("aria-labelledby") === triggerId
            } as ElementFinderConfig;
        },
    },
    SETTINGS_MODAL: {
        dialog: { selector: '[role="dialog"]' } as ElementFinderConfig,
        title: { selector: '[role="dialog"] h2', textIncludes: "Settings" } as ElementFinderConfig,

        leftNavContainer: { selector: "div", classContains: ["flex", "flex-col", "gap-1.5", "pl-3", "pb-3"] } as ElementFinderConfig,
        leftNavButton: { selector: '[role="dialog"] [data-slot="button"]', classContains: ["justify-start", "min-w-40"] } as ElementFinderConfig,

        contentArea: { selector: "div", filter: el => el.classList.contains("overflow-scroll") || el.classList.contains("overflow-y-auto") } as ElementFinderConfig,

        accountButton: { selector: '[role="dialog"] [data-slot="button"]', classContains: ["justify-start", "min-w-40"], textIncludes: "Account" } as ElementFinderConfig,
        appearanceButton: { selector: '[role="dialog"] [data-slot="button"]', classContains: ["justify-start", "min-w-40"], textIncludes: "Appearance" } as ElementFinderConfig,
        behaviorButton: { selector: '[role="dialog"] [data-slot="button"]', classContains: ["justify-start", "min-w-40"], textIncludes: "Behavior" } as ElementFinderConfig,
        customizeButton: { selector: '[role="dialog"] [data-slot="button"]', classContains: ["justify-start", "min-w-40"], textIncludes: "Customize" } as ElementFinderConfig,
        dataControlsButton: { selector: '[role="dialog"] [data-slot="button"]', classContains: ["justify-start", "min-w-40"], textIncludes: "Data Controls" } as ElementFinderConfig,
        subscriptionButton: { selector: '[role="dialog"] [data-slot="button"]', classContains: ["justify-start", "min-w-40"], textIncludes: "Subscription" } as ElementFinderConfig,

        navButtonByText(text: string | RegExp): ElementFinderConfig {
            return {
                selector: '[role="dialog"] [data-slot="button"]',
                classContains: ["justify-start", "min-w-40"],
                ...(typeof text === "string" ? { textIncludes: text } : { textMatches: text })
            } as ElementFinderConfig;
        },
    },
    CODE_BLOCK: {
        block: "div.relative.not-prose.\\@container\\/code-block" as AnySelector,
        buttonsContainer: "div.absolute.bottom-1.right-1" as AnySelector,
        buttonGroup: "div.flex.flex-row.gap-0\\.5" as AnySelector,
        headerRow: "div.flex.flex-row.px-4.py-2.h-10.items-center.rounded-t-xl.bg-surface-l2.border.border-border-l1" as AnySelector,
        languageLabel: "span.font-mono.text-xs" as AnySelector,
    },
    EFFECTS: {
        idleSparklesContainer: { selector: 'div[style*="opacity:"] > div.absolute.top-0.left-0.w-full.h-full' } as ElementFinderConfig,
    },
} as const;

export const Locators = LOCATORS;

export type SidebarLocators = typeof LOCATORS.SIDEBAR;
export type QueryBarLocators = typeof LOCATORS.QUERY_BAR;

