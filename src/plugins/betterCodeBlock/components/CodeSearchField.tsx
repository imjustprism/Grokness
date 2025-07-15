/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LucideIcon } from "@components/LucideIcon";
import React, { useEffect, useRef, useState } from "react";

export const DEFAULT_HIGHLIGHT_CLASS = "grok-code-highlight";
export const DEFAULT_HIGHLIGHT_CURRENT_CLASS = "grok-code-highlight-current";

function clearHighlights(codeElement: HTMLElement, highlightClass: string) {
    const highlightedSpans = codeElement.querySelectorAll(`span.${highlightClass}`);
    highlightedSpans.forEach(span => {
        const { parentNode } = span;
        if (parentNode) {
            parentNode.replaceChild(document.createTextNode(span.textContent || ""), span);
            parentNode.normalize();
        }
    });
}

function highlightMatches(codeElement: HTMLElement, searchQuery: string, highlightClass: string) {
    clearHighlights(codeElement, highlightClass);
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
                highlightSpan.className = highlightClass;
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
            if (!(element.tagName === "SPAN" && element.classList.contains(highlightClass))) {
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
    containerClassName?: string;
    /** Additional class names for the icon */
    iconClassName?: string;
    /** Additional class names for the input */
    inputClassName?: string;
    /** Size of the search icon */
    iconSize?: number;
    /** Placeholder text for the input */
    placeholder?: string;
    /** Optional callback when search query changes */
    onSearchChange?: (query: string) => void;
    /** Class name for highlighted matches */
    highlightClass?: string;
    /** Class name for current highlighted match */
    highlightCurrentClass?: string;
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
    containerClassName = "",
    iconClassName = "",
    inputClassName = "",
    iconSize = 16,
    placeholder = "Search...",
    onSearchChange,
    highlightClass = DEFAULT_HIGHLIGHT_CLASS,
    highlightCurrentClass = DEFAULT_HIGHLIGHT_CURRENT_CLASS,
}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        highlightMatches(codeElement, searchQuery, highlightClass);
        onSearchChange?.(searchQuery);
        return () => clearHighlights(codeElement, highlightClass);
    }, [searchQuery, codeElement, onSearchChange, highlightClass]);

    useEffect(() => {
        setCurrentIndex(0);
    }, [searchQuery]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            const highlights = codeElement.querySelectorAll(`span.${highlightClass}`);
            if (highlights.length > 0) {
                highlights.forEach(h => h.classList.remove(highlightCurrentClass));
                const target = highlights[currentIndex] as HTMLElement;
                target.classList.add(highlightCurrentClass);
                target.scrollIntoView({ behavior: "smooth", block: "center" });
                setCurrentIndex(prev => (prev + 1) % highlights.length);
            }
        }
    };

    return (
        <div
            className={`relative inline-flex items-center h-8 rounded-xl bg-surface-l1 dark:bg-surface-l2 hover:bg-surface-l4-hover dark:hover:bg-surface-l3 transition-colors px-2 hover:[&>.lucide]:text-fg-primary ${containerClassName}`}
        >
            <LucideIcon
                name="Search"
                size={iconSize}
                className={`lucide text-fg-secondary absolute left-2 ${iconClassName}`}
            />
            <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`bg-transparent outline-none pl-6 pr-2 w-28 sm:w-40 text-xs text-fg-primary placeholder:text-fg-secondary ${inputClassName}`}
            />
        </div>
    );
};
