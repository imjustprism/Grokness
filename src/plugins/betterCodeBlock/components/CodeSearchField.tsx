/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Lucide } from "@components/Lucide";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

export const DEFAULT_HIGHLIGHT_CLASS = "grok-code-highlight";
export const DEFAULT_HIGHLIGHT_CURRENT_CLASS = "grok-code-highlight-current";

const CODE_BLOCK_SELECTOR = "div.relative.not-prose.\\@container\\/code-block";
const CODE_TAG_SELECTOR = "code";

export const CodeSearchField: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const originalContentRef = useRef<string>("");

    useLayoutEffect(() => {
        const codeTag = containerRef.current
            ?.closest(CODE_BLOCK_SELECTOR)
            ?.querySelector(CODE_TAG_SELECTOR) as HTMLElement | null;

        if (codeTag && !originalContentRef.current) {
            originalContentRef.current = codeTag.innerHTML;
        }
    }, []);

    useEffect(() => {
        const codeTag = containerRef.current
            ?.closest(CODE_BLOCK_SELECTOR)
            ?.querySelector(CODE_TAG_SELECTOR) as HTMLElement | null;

        if (!codeTag) {
            return;
        }

        if (!searchQuery.trim()) {
            if (originalContentRef.current) {
                codeTag.innerHTML = originalContentRef.current;
            }
            return;
        }

        const plainText = codeTag.textContent ?? "";
        const searchRegex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        for (const match of plainText.matchAll(searchRegex)) {
            const index = match.index ?? 0;
            if (index > lastIndex) {
                fragment.appendChild(document.createTextNode(plainText.slice(lastIndex, index)));
            }
            const highlightSpan = document.createElement("span");
            highlightSpan.className = DEFAULT_HIGHLIGHT_CLASS;
            highlightSpan.textContent = match[0];
            fragment.appendChild(highlightSpan);
            lastIndex = index + match[0].length;
        }

        if (lastIndex < plainText.length) {
            fragment.appendChild(document.createTextNode(plainText.slice(lastIndex)));
        }

        codeTag.innerHTML = "";
        codeTag.appendChild(fragment);

    }, [searchQuery]);

    useEffect(() => {
        setCurrentIndex(0);
    }, [searchQuery]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            const codeTag = containerRef.current
                ?.closest(CODE_BLOCK_SELECTOR)
                ?.querySelector(CODE_TAG_SELECTOR) as HTMLElement | null;

            if (codeTag) {
                const highlights = codeTag.querySelectorAll(`span.${DEFAULT_HIGHLIGHT_CLASS}`);
                if (highlights.length > 0) {
                    highlights.forEach(h => h.classList.remove(DEFAULT_HIGHLIGHT_CURRENT_CLASS));
                    const target = highlights[currentIndex] as HTMLElement;
                    target.classList.add(DEFAULT_HIGHLIGHT_CURRENT_CLASS);
                    target.scrollIntoView({ behavior: "smooth", block: "center" });
                    setCurrentIndex(prev => (prev + 1) % highlights.length);
                }
            }
        }
    };

    return (
        <div
            ref={containerRef}
            className="relative inline-flex items-center h-8 rounded-xl bg-surface-l1 dark:bg-surface-l2 hover:bg-surface-l4-hover dark:hover:bg-surface-l3 transition-colors px-2 hover:[&>.lucide]:text-fg-primary"
        >
            <Lucide name="Search" size={16} className="lucide text-fg-secondary absolute left-2" />
            <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-transparent outline-none pl-6 pr-2 w-28 sm:w-40 text-xs text-fg-primary placeholder:text-fg-secondary"
            />
        </div>
    );
};
