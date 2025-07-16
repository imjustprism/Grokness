/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LucideIcon, type LucideIconName } from "@components/LucideIcon";
import clsx from "clsx";
import React from "react";

interface TabButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: LucideIconName;
    label: string;
    isActive?: boolean;
}

export const TabButton: React.FC<TabButtonProps> = ({
    icon,
    label,
    isActive = false,
    className,
    ...props
}) => (
    <button
        {...props}
        aria-selected={isActive}
        className={clsx(
            "inline-flex items-center whitespace-nowrap font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-100 [&_svg]:shrink-0 select-none disabled:hover:bg-transparent border border-transparent rounded-xl py-2 text-sm group gap-3 px-4 justify-start h-10 min-w-40",
            isActive ? "text-primary bg-button-ghost-hover" : "text-fg-primary hover:bg-card-hover hover:text-primary",
            className
        )}
    >
        <LucideIcon
            name={icon}
            size={18}
            className={clsx(isActive ? "text-primary" : "text-secondary group-hover:text-primary")}
        />
        {label}
    </button>
);
