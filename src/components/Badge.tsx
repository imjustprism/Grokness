/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Slot } from "@radix-ui/react-slot";
import clsx from "clsx";
import React, { type ElementType } from "react";

/**
 * Visual badge with optional asChild composition via Radix Slot.
 * Provides small, unobtrusive labels and status indicators.
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLElement> {
    /** Render as a different element/component. If set to "slot", uses Radix Slot for composition. */
    as?: ElementType | "slot";
    /** Optional custom content. */
    children?: React.ReactNode;
    /** Visual variant. */
    variant?: "solid" | "soft" | "outline";
    /** Color intent. */
    color?: "default" | "info" | "success" | "warning" | "danger";
    /** Size scale. Use "inherit" to match parent text size without forcing a font-size. */
    size?: "inherit" | "xs" | "sm" | "md" | "lg";
    /** Optional additional text sizing classes to finely control font-size/leading. */
    textClassName?: string;
    /** Show a leading status dot. */
    dot?: boolean;
    /** Additional class names. */
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
    as: Component = "div",
    children,
    variant = "solid",
    color = "default",
    size = "sm",
    textClassName,
    dot = false,
    className,
    style,
    ...rest
}) => {
    const Comp = (Component === "slot" ? Slot : Component) as ElementType;

    const sizeClasses =
        size === "inherit"
            ? "px-1.5 py-0.5"
            : size === "xs"
                ? "px-1 h-4 text-[0.625rem] leading-[0.85rem]"
                : size === "md"
                    ? "px-2 h-6 text-[0.75rem] leading-[1.1rem]"
                    : size === "lg"
                        ? "px-2.5 h-7 text-[0.875rem] leading-[1.25rem]"
                        : "px-1.5 h-5 text-[0.6875rem] leading-[0.9rem]";

    const colorSoft = {
        info: "text-blue-400 bg-blue-400/10 border border-blue-400/20",
        success: "text-green-400 bg-green-400/10 border border-green-400/20",
        warning: "text-yellow-400 bg-yellow-400/10 border border-yellow-400/20",
        danger: "text-red-400 bg-red-400/10 border border-red-400/20",
    } as const;

    const colorOutline = {
        info: "text-blue-400 border border-blue-400/50",
        success: "text-green-400 border border-green-400/50",
        warning: "text-yellow-400 border border-yellow-400/50",
        danger: "text-red-400 border border-red-400/50",
    } as const;

    const base = clsx(
        "inline-flex items-center gap-1 rounded-md cursor-default select-none",
        "opacity-100 disabled:opacity-60",
        sizeClasses,
        variant === "solid" && color !== "default" && "text-white",
        variant === "solid" && color === "default" && "bg-surface-l2 text-secondary",
        variant === "soft" && "backdrop-blur-sm",
        variant === "soft" && color !== "default" && colorSoft[color],
        variant === "outline" && color !== "default" && colorOutline[color],
        textClassName,
        className
    );

    const solidColorStyle = variant === "solid" && color !== "default" ? (
        color === "info" ? { backgroundColor: "#2563eb" } :
            color === "success" ? { backgroundColor: "#16a34a" } :
                color === "warning" ? { backgroundColor: "#f59e0b" } :
                    color === "danger" ? { backgroundColor: "#ef4444" } : undefined
    ) : undefined;

    const inheritStyle = size === "inherit" ? { fontSize: "inherit", lineHeight: "inherit" } as React.CSSProperties : undefined;

    return (
        <Comp
            className={base}
            style={{ ...(inheritStyle || {}), ...(solidColorStyle || {}), ...(style ?? {}) }}
            {...rest}
        >
            {dot ? <span className={clsx("inline-block w-1.5 h-1.5 rounded-full", color === "default" ? "bg-secondary/70" : "bg-current")} /> : null}
            {children}
        </Comp>
    );
};

Badge.displayName = "Badge";

