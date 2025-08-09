/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import styles from "@plugins/collapseLongPrompt/styles.css?raw";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/logger";
import { definePlugin, definePluginSettings, useSetting } from "@utils/types";
import React from "react";

const logger = new Logger("CollapseLongPrompt", "#f2d5cf");

const settings = definePluginSettings({
    characterLimit: {
        type: "number",
        displayName: "Character Limit",
        description: "Collapse prompts longer than this number of characters.",
        default: 1500,
        min: 100,
    },
    maxVisibleHeight: {
        type: "string",
        displayName: "Max Visible Height",
        description: "Maximum height of the prompt when collapsed (CSS value).",
        default: "6em",
    },
});

const USER_PROMPT_SELECTOR = "div.message-bubble.bg-surface-l2.border.border-border-l1";
const PROMPT_CONTENT_SELECTOR = "span.whitespace-pre-wrap";
const PROMPT_PADDING_RIGHT = "3rem";

const CollapsePrompt: React.FC<{ rootElement?: HTMLElement; }> = ({ rootElement }) => {
    const [characterLimit] = useSetting<typeof settings.definition, "characterLimit">("collapse-long-prompt", "characterLimit");
    const [maxVisibleHeight] = useSetting<typeof settings.definition, "maxVisibleHeight">("collapse-long-prompt", "maxVisibleHeight");

    if (!rootElement) {
        logger.warn("no root");
        return null;
    }

    const content = rootElement.querySelector(PROMPT_CONTENT_SELECTOR) as HTMLElement | null;
    if (!content) {
        return null;
    }

    const len = content.textContent?.length ?? 0;
    if (len <= characterLimit) {
        return null;
    }

    const [collapsed, setCollapsed] = React.useState(true);
    const originalPaddingRight = React.useRef<string | null>(null);
    const originalDisplay = React.useRef<string | null>(null);
    const originalWidth = React.useRef<string | null>(null);

    const contentStyle = React.useMemo(() => window.getComputedStyle(content), [content]);

    React.useLayoutEffect(() => {
        if (originalPaddingRight.current === null) {
            originalPaddingRight.current = rootElement.style.paddingRight;
            rootElement.style.paddingRight = `calc(${originalPaddingRight.current || "1rem"} + ${PROMPT_PADDING_RIGHT})`;
            rootElement.style.position = "relative";
        }
        if (originalDisplay.current === null) {
            originalDisplay.current = content.style.display;
        }
        if (originalWidth.current === null) {
            originalWidth.current = rootElement.style.width;
        }
        return () => {
            if (originalPaddingRight.current !== null) {
                rootElement.style.paddingRight = originalPaddingRight.current;
            }
            rootElement.style.position = "";
            if (originalDisplay.current !== null) {
                content.style.display = originalDisplay.current;
            }
            if (originalWidth.current !== null) {
                rootElement.style.width = originalWidth.current;
            }
        };
    }, [rootElement, content]);

    React.useLayoutEffect(() => {
        if (collapsed) {
            rootElement.style.maxHeight = maxVisibleHeight;
            rootElement.style.overflow = "hidden";
            rootElement.style.minHeight = maxVisibleHeight;
            rootElement.style.width = "100%";
            content.style.display = "none";
        } else {
            rootElement.style.maxHeight = "";
            rootElement.style.overflow = "";
            rootElement.style.minHeight = "";
            rootElement.style.width = originalWidth.current || "";
            content.style.display = originalDisplay.current || "";
        }
    }, [collapsed, rootElement, content, maxVisibleHeight]);

    return (
        <>
            {collapsed && (
                <span
                    className="whitespace-pre-wrap text-layer"
                    style={{
                        fontSize: contentStyle.fontSize,
                        fontFamily: contentStyle.fontFamily,
                        fontWeight: contentStyle.fontWeight,
                        lineHeight: contentStyle.lineHeight,
                        color: contentStyle.color,
                        letterSpacing: contentStyle.letterSpacing,
                        wordSpacing: contentStyle.wordSpacing,
                        textAlign: contentStyle.textAlign as React.CSSProperties["textAlign"],
                    }}
                    dangerouslySetInnerHTML={{ __html: content.innerHTML }}
                />
            )}
            {collapsed && <div className="fade-overlay" />}
            {collapsed && <span className="ellipsis">...</span>}
            <Button
                className="prompt-toggle-button"
                icon={collapsed ? "ChevronDown" : "ChevronUp"}
                size="icon"
                variant="ghost"
                iconSize={20}
                onClick={() => setCollapsed(p => !p)}
                tooltip={collapsed ? "Expand prompt" : "Collapse prompt"}
            />
        </>
    );
};

const patch = {
    component: CollapsePrompt,
    target: USER_PROMPT_SELECTOR,
    forEach: true,
    getTargetParent: (el: HTMLElement) => el,
    referenceNode: () => null,
};

export default definePlugin({
    name: "Collapse Prompt",
    description: "Automatically collapses long user prompts in chat.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["prompt", "collapse", "user", "optimize"],
    styles,
    settings,
    patches: [patch],
});
