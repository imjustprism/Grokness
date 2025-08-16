/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import clsx from "clsx";
import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, className, ...rest }) => {
    const base = clsx(
        "px-1.5 rounded-md cursor-default",
        "text-xs leading-4",
        "text-secondary",
        "opacity-100 disabled:opacity-60",
        className
    );
    return (
        <div className={base} style={{ backgroundColor: "#28282a" }} {...rest}>
            {children}
        </div>
    );
};

Badge.displayName = "Badge";

