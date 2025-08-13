/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { AnySelector, ElementFinderConfig } from "@utils/dom";

const el = (selector: string, extras: Partial<ElementFinderConfig> = {}): ElementFinderConfig => ({ selector, ...extras });
const button = (extras: Partial<ElementFinderConfig> = {}): ElementFinderConfig => el("button", extras);
const withinDialogButton = (extras: Partial<ElementFinderConfig> = {}): ElementFinderConfig => ({ selector: '[role="dialog"] [data-slot="button"]', ...extras });

/**
 * Central, strongly typed collection of DOM locators used throughout the app.
 */
export const LOCATORS = {
    COMMON: {
        buttonByText(text: string | RegExp): ElementFinderConfig {
            return button(typeof text === "string" ? { textIncludes: text } : { textMatches: text });
        },
        containerByClasses(...classes: string[]): ElementFinderConfig {
            return el("div", { classContains: classes });
        },
    },
    SIDEBAR: {
        container: el('[data-sidebar="sidebar"]'),
        header: el('[data-sidebar="header"]'),
        homeLink: el('a[aria-label="Home page"]'),
        content: el('[data-sidebar="content"]'),
        group: el('[data-sidebar="group"]'),
        menu: el('ul[data-sidebar="menu"]'),
        menuItem: el('li[data-sidebar="menu-item"]'),
        menuButton: el('[data-sidebar="menu-button"]'),
        menuIcon: el('[data-sidebar="icon"]'),

        searchButton: el('[data-sidebar="menu-button"]', { ariaLabel: "Search" }),
        voiceButton: el('[data-sidebar="menu-button"]', { ariaLabel: "Voice" }),
        filesLink: el('[data-sidebar="menu-button"]', { textIncludes: "Files" }),
        tasksLink: el('[data-sidebar="menu-button"]', { textIncludes: "Tasks" }),
        projectsLink: el('[data-sidebar="menu-button"]', { textIncludes: "Projects" }),
        historyButton: el('[data-sidebar="menu-button"]', { ariaLabel: "History" }),

        footer: "[data-sidebar=\"footer\"]" as AnySelector,
        avatarButton: 'button[aria-haspopup="menu"]' as AnySelector,
        toggleButton: el('button[data-sidebar="trigger"]'),
        toggleIcon: "[data-sidebar=\"trigger\"] svg" as AnySelector,

        menuButtonByText(text: string): ElementFinderConfig {
            return el('[data-sidebar="menu-button"]', { textIncludes: text });
        },
        menuButtonByAria(label: string | RegExp): ElementFinderConfig {
            return el('[data-sidebar="menu-button"]', typeof label === "string" ? { ariaLabel: label } : { ariaLabel: label });
        },
        menuItemByText(text: string): ElementFinderConfig {
            return el('li[data-sidebar="menu-item"] [data-sidebar="menu-button"]', { textIncludes: text });
        },
    },
    QUERY_BAR: {
        root: ".query-bar" as AnySelector,
        modelButton: button({
            selector: "button#model-select-trigger,button[role='combobox'][data-slot='select-trigger'],button",
            svgPartialD: "M5 14.25L14 4",
        }),
        modelNameSpan: "span.font-semibold, span.inline-block" as AnySelector,
        hiddenModelSelect: "select[aria-hidden='true']" as AnySelector,
        textarea: el(".query-bar textarea"),
        editor: el(".tiptap.ProseMirror"),
        editorParagraph: el(".tiptap.ProseMirror p"),
        editorPlaceholder: el(".tiptap.ProseMirror p[data-placeholder]"),
        editorPlaceholderDefault: el(".tiptap.ProseMirror p[data-placeholder]", { textIncludes: "What do you want to know?" }),
        editorPlaceholderChat: el(".tiptap.ProseMirror p[data-placeholder]", { textIncludes: "How can Grok help?" }),
        projectButton: button({ svgPartialD: "M3.33965 17L11.9999 22L20.6602 17V7" }),
        attachButton: button({ svgPartialD: "M10 9V15C10 16.1046 10.8954 17 12 17V17C13.1046 17 14 16.1046 14 15V7C14 4.79086 12.2091 3 10 3V3C7.79086 3 6 4.79086 6 7V15C6 18.3137 8.68629 21 12 21V21C15.3137 21 18 18.3137 18 15V8" }),
        voiceModeButton: el("button", { filter: el => el.querySelectorAll("div.w-0.5").length >= 5 }),

        buttonByAria(label: string | RegExp): ElementFinderConfig {
            return button(typeof label === "string" ? { ariaLabel: label } : { ariaLabel: label });
        },
        buttonWithSvgPath(pathD: string): ElementFinderConfig {
            return button({ svgPartialD: pathD });
        },
        editorPlaceholderByText(text: string | RegExp): ElementFinderConfig {
            return el(".tiptap.ProseMirror p[data-placeholder]", typeof text === "string" ? { textIncludes: text } : { textMatches: text });
        },
    },
    CHAT_NAV: {
        container: el("div", { classContains: ["absolute", "flex", "items-center", "ms-auto", "end-3"] }),
        homeLink: el('a[href="/"]'),
        pinButton: button({ ariaLabel: "Pin" }),
        shareButton: button({ ariaLabel: "Share conversation" }),

        iconButtonByAria(label: string | RegExp): ElementFinderConfig {
            return button(typeof label === "string" ? { ariaLabel: label } : { ariaLabel: label });
        },
        anchorByHref(href: string | RegExp): ElementFinderConfig {
            return el("a", typeof href === "string"
                ? { filter: el => (el as HTMLAnchorElement).getAttribute("href") === href }
                : { filter: el => href.test((el as HTMLAnchorElement).getAttribute("href") ?? "") });
        },
    },
    CHAT: {
        messageBubble: el("div.message-bubble.bg-surface-l2"),
        messageContainer: el("div.relative.group"),
        editButton: button({ ariaLabel: "Edit" }),
    },
    AVATAR_MENU: {
        wrapper: el("[data-radix-popper-content-wrapper]"),
        menu: el('[data-radix-menu-content][role="menu"][data-state="open"]'),
        menuItem: el('[data-radix-menu-content][data-state="open"] [role="menuitem"]'),

        settings: el('[role="menuitem"]', { textIncludes: "Settings" }),
        reportIssue: el('[role="menuitem"]', { textIncludes: "Report Issue" }),
        community: el('a[role="menuitem"]', {
            filter: el => {
                const a = el as HTMLAnchorElement;
                const text = (a.textContent ?? "").trim();
                return text.includes("Community") || a.href.includes("discord.gg");
            },
        }),
        manageSubscription: el('[role="menuitem"]', { textIncludes: "Manage Subscription" }),
        signOut: el('[role="menuitem"]', { textIncludes: "Sign Out" }),

        itemByText(text: string | RegExp): ElementFinderConfig {
            return el('[data-radix-menu-content][data-state="open"] [role="menuitem"]', typeof text === "string" ? { textIncludes: text } : { textMatches: text });
        },
        menuByTriggerId(triggerId: string): ElementFinderConfig {
            return el('[data-radix-menu-content][role="menu"]', { filter: el => el.getAttribute("aria-labelledby") === triggerId });
        },
    },
    SETTINGS_MODAL: {
        dialog: el('[role="dialog"]'),
        title: el('[role="dialog"] h2', { textIncludes: "Settings" }),

        leftNavContainer: el("div", { classContains: ["flex", "flex-col", "gap-1.5", "pl-3", "pb-3"] }),
        leftNavButton: withinDialogButton({ classContains: ["justify-start", "min-w-40"] }),

        contentArea: el("div", { filter: el => el.classList.contains("overflow-scroll") || el.classList.contains("overflow-y-auto") }),

        accountButton: withinDialogButton({ classContains: ["justify-start", "min-w-40"], textIncludes: "Account" }),
        appearanceButton: withinDialogButton({ classContains: ["justify-start", "min-w-40"], textIncludes: "Appearance" }),
        behaviorButton: withinDialogButton({ classContains: ["justify-start", "min-w-40"], textIncludes: "Behavior" }),
        customizeButton: withinDialogButton({ classContains: ["justify-start", "min-w-40"], textIncludes: "Customize" }),
        dataControlsButton: withinDialogButton({ classContains: ["justify-start", "min-w-40"], textIncludes: "Data Controls" }),
        subscriptionButton: withinDialogButton({ classContains: ["justify-start", "min-w-40"], textIncludes: "Subscription" }),

        navButtonByText(text: string | RegExp): ElementFinderConfig {
            return withinDialogButton({
                classContains: ["justify-start", "min-w-40"],
                ...(typeof text === "string" ? { textIncludes: text } : { textMatches: text })
            });
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
        idleSparklesContainer: el('div[style*="opacity:"] > div.absolute.top-0.left-0.w-full.h-full'),
    },
} as const;

export const Locators = LOCATORS;

export type SidebarLocators = typeof LOCATORS.SIDEBAR;
export type QueryBarLocators = typeof LOCATORS.QUERY_BAR;

