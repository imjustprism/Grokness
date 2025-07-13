/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import clsx from "clsx";
import React, { forwardRef, useEffect, useRef } from "react";

/**
 * Props for the SectionTitle component.
 *
 * @property children - The content of the section title (usually text or elements).
 * @property className - Additional class names to apply for custom styling.
 * @property testID - Optional test id for testing purposes.
 * @property All other standard HTML heading element props are supported.
 */
export interface SectionTitleProps
    extends React.HTMLAttributes<HTMLHeadingElement> {
    /**
     * The content of the section title (usually text or elements).
     */
    children: React.ReactNode;
    /**
     * Additional class names to apply for custom styling.
     */
    className?: string;
    /**
     * Optional test id for testing purposes.
     */
    testID?: string;
}

/**
 * A modern, accessible, and professional section title for grouping content.
 * - Uses semantic <h2> by default.
 * - Keyboard focusable for accessibility.
 * - Customizable via className and testID.
 * - Visual focus ring for keyboard navigation.
 */
export const SectionTitle = forwardRef<HTMLHeadingElement, SectionTitleProps>(
    ({ children, className, testID, tabIndex = 0, ...props }, ref) => {
        const localRef = useRef<HTMLHeadingElement>(null);
        const combinedRef = (node: HTMLHeadingElement) => {
            if (typeof ref === "function") {
                ref(node);
            } else if (ref) {
                (
                    ref as React.MutableRefObject<HTMLHeadingElement | null>
                ).current = node;
            }
            localRef.current = node;
        };

        useEffect(() => { }, [testID]);

        return (
            <h2
                ref={combinedRef}
                className={clsx(
                    "pb-3 text-xs font-medium uppercase text-gray-400 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-primary/5 transition-shadow",
                    className
                )}
                data-testid={testID}
                tabIndex={tabIndex}
                {...props}
            >
                {children}
            </h2>
        );
    }
);

SectionTitle.displayName = "SectionTitle";
