/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LucideIcon } from "@components/LucideIcon";
import React, { useEffect, useRef, useState } from "react";

const HIGHLIGHT_CLASS = "grok-code-highlight";
const HIGHLIGHT_CURRENT_CLASS = "grok-code-highlight-current";

function clearHighlights(codeElement: HTMLElement) {
    const highlightedSpans = codeElement.querySelectorAll(`span.${HIGHLIGHT_CLASS}`);
    highlightedSpans.forEach(span => {
        const { parentNode } = span;
        if (parentNode) {
            parentNode.replaceChild(document.createTextNode(span.textContent || ""), span);
            parentNode.normalize();
        }
    });
}

function highlightMatches(codeElement: HTMLElement, searchQuery: string) {
    clearHighlights(codeElement);
    if (!searchQuery.trim()) {
        return;
    }

    const searchRegex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");

    function processNode(currentNode: Node) {
        if (currentNode.nodeType === Node.TEXT_NODE) {
            const nodeText = currentNode.textContent || "";
            const { parentNode } = currentNode;
            if (!parentNode || nodeText.length === 0) {
                return;
            }

            let regexMatch;
            const nodeFragments: (Text | HTMLElement)[] = [];
            let lastMatchIndex = 0;

            while ((regexMatch = searchRegex.exec(nodeText)) !== null) {
                if (regexMatch.index > lastMatchIndex) {
                    nodeFragments.push(document.createTextNode(nodeText.slice(lastMatchIndex, regexMatch.index)));
                }
                const highlightSpan = document.createElement("span");
                highlightSpan.className = HIGHLIGHT_CLASS;
                highlightSpan.textContent = regexMatch[0];
                nodeFragments.push(highlightSpan);
                lastMatchIndex = searchRegex.lastIndex;
            }

            if (lastMatchIndex < nodeText.length) {
                nodeFragments.push(document.createTextNode(nodeText.slice(lastMatchIndex)));
            }

            if (nodeFragments.length > 0) {
                nodeFragments.forEach(fragment => parentNode.insertBefore(fragment, currentNode));
                parentNode.removeChild(currentNode);
            }
        } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const element = currentNode as Element;
            if (!(element.tagName === "SPAN" && element.classList.contains(HIGHLIGHT_CLASS))) {
                Array.from(currentNode.childNodes).forEach(processNode);
            }
        }
    }

    processNode(codeElement);
}

export interface CodeSearchFieldProps {
    /** The code element to search within */
    codeElement: HTMLElement;
    /** Additional class names for the container */
    className?: string;
    /** Size of the search icon */
    iconSize?: number;
    /** Width class for the input */
    inputWidth?: string;
    /** Placeholder text for the input */
    placeholder?: string;
    /** Optional callback when search query changes */
    onSearchChange?: (query: string) => void;
}

/**
 * CodeSearchField component for searching within code blocks
 *
 * @example
 * ```tsx
 * <CodeSearchField codeElement={codeContainer} />
 * ```
 */
export const CodeSearchField: React.FC<CodeSearchFieldProps> = ({
    codeElement,
    className = "",
    iconSize = 16,
    inputWidth = "w-28 sm:w-40",
    placeholder = "Search...",
    onSearchChange,
}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        highlightMatches(codeElement, searchQuery);
        onSearchChange?.(searchQuery);
        return () => clearHighlights(codeElement);
    }, [searchQuery, codeElement, onSearchChange]);

    useEffect(() => {
        setCurrentIndex(0);
    }, [searchQuery]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            const highlights = codeElement.querySelectorAll(`span.${HIGHLIGHT_CLASS}`);
            if (highlights.length > 0) {
                highlights.forEach(h => h.classList.remove(HIGHLIGHT_CURRENT_CLASS));
                const target = highlights[currentIndex] as HTMLElement;
                target.classList.add(HIGHLIGHT_CURRENT_CLASS);
                target.scrollIntoView({ behavior: "smooth", block: "center" });
                setCurrentIndex(prev => (prev + 1) % highlights.length);
            }
        }
    };

    return (
        <div className={`group-search relative inline-flex items-center h-8 rounded-xl bg-surface-l1 dark:bg-surface-l2 hover:bg-surface-l4-hover dark:hover:bg-surface-l3 transition-colors px-2 ${className}`}>
            <LucideIcon
                name="Search"
                size={iconSize}
                className="text-fg-secondary group-hover/search:text-fg-primary absolute left-2"
            />
            <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`bg-transparent outline-none pl-6 pr-2 ${inputWidth} text-xs text-fg-primary placeholder:text-fg-secondary`}
            />
        </div>
    );
};
