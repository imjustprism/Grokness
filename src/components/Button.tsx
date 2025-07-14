/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import clsx from "clsx";
import React, { type ElementType } from "react";

export type ButtonVariant = "outline" | "solid" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonColor = "default" | "danger";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    rounded?: boolean;
    size?: ButtonSize;
    icon?: React.ReactNode;
    iconPosition?: "left" | "right";
    as?: ElementType;
    className?: string;
    children: React.ReactNode;
    color?: ButtonColor;
}

export const Button = React.forwardRef<HTMLElement, ButtonProps>(
    (
        {
            variant = "outline",
            rounded = true,
            size = "md",
            icon,
            iconPosition = "left",
            as: Component = "button",
            children,
            className,
            color = "default",
            ...props
        },
        ref
    ) => {
        const baseClasses = [
            "inline-flex items-center justify-center gap-2",
            "whitespace-nowrap font-medium cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "transition-colors duration-100",
            "[&_svg]:shrink-0 select-none border",
            rounded ? "rounded-full" : "rounded-md",
            "group"
        ];

        const sizeClasses: Record<ButtonSize, string> = {
            sm: "h-8 px-3 py-1.5 text-xs",
            md: "h-10 px-3.5 py-2 text-sm",
            lg: "h-12 px-5 py-3 text-base",
        };

        const variantClasses = {
            outline:
                "border-border-l2 text-fg-primary hover:bg-button-ghost-hover disabled:hover:bg-transparent",
            solid:
                "border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:hover:bg-blue-600",
            ghost:
                "border-transparent text-fg-primary hover:bg-button-ghost-hover disabled:hover:bg-transparent",
        };

        const colorClasses = {
            default: "",
            danger: "text-fg-danger border-[hsl(var(--fg-danger))] bg-[hsl(var(--fg-danger))/0.1] hover:bg-[hsl(var(--fg-danger))/0.2] [&_svg]:text-fg-danger [&_svg]:hover:text-fg-danger",
        };

        const iconHoverClass = color === "default" && variant === "outline" ? "[&_svg]:hover:text-fg-primary" : "";

        const allClasses = clsx(
            ...baseClasses,
            sizeClasses[size],
            variantClasses[variant],
            iconHoverClass,
            colorClasses[color],
            className
        );

        const content = (
            <>
                {icon && iconPosition === "left" && <span className="flex-shrink-0">{icon}</span>}
                {children}
                {icon && iconPosition === "right" && <span className="flex-shrink-0">{icon}</span>}
            </>
        );

        return (
            <Component
                ref={ref}
                className={allClasses}
                type={Component === "button" ? props.type || "button" : undefined}
                {...props}
            >
                {content}
            </Component>
        );
    }
);

Button.displayName = "Button";
