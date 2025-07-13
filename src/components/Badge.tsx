/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import clsx from "clsx";
import React from "react";

/**
 * Props for the Badge component
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** The content to display inside the badge */
    children: React.ReactNode;
    /** Visual variant of the badge */
    variant?: "default" | "primary" | "secondary";
    /** Size of the badge */
    size?: "sm" | "md" | "lg";
    /** Additional CSS classes to apply */
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = "default",
    size = "sm",
    className,
    ...props
}) => (
    <span
        className={clsx(
            "inline-flex items-center justify-center",
            "text-[10px] px-1.5 py-0.5 rounded-md",
            "border border-border-l2",
            {
                "bg-surface-l1 dark:bg-surface-l2 text-fg-secondary":
                    variant === "default",
                "bg-primary/10 text-primary": variant === "primary",
                "bg-secondary/10 text-secondary": variant === "secondary",
                "text-[10px]": size === "sm",
                "text-xs": size === "md",
                "text-sm": size === "lg",
            },
            className
        )}
        {...props}
    >
        {children}
    </span>
);
