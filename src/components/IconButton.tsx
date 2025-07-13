/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LucideIcon, type LucideIconName } from "@components/LucideIcon";
import * as Tooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import React, { type ComponentPropsWithoutRef, type ElementType } from "react";

type IconProps = {
    className?: string;
    size?: number;
    strokeWidth?: number;
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ComponentType<IconProps> | LucideIconName;
    size?: "sm" | "md" | "lg";
    variant?: "ghost" | "solid" | "outline";
    as?: ElementType;
    loading?: boolean;
    iconSize?: number;
    className?: string;
    href?: string;
    tooltipContent?: React.ReactNode;
    tooltipContentProps?: Omit<ComponentPropsWithoutRef<typeof Tooltip.Content>, "children">;
    tooltipProps?: Omit<ComponentPropsWithoutRef<typeof Tooltip.Root>, "children">;
    children?: React.ReactNode;
    rounded?: boolean;
    toggleGroup?: string;
}

export const IconButton = React.forwardRef<HTMLElement, IconButtonProps>(
    (
        {
            icon,
            size = "md",
            variant = "outline",
            as: Component = "button",
            loading = false,
            className,
            iconSize = 18,
            disabled,
            href,
            tooltipContent,
            tooltipContentProps,
            tooltipProps,
            children,
            rounded = true,
            toggleGroup,
            ...props
        },
        ref
    ) => {
        const sizeClasses = {
            sm: children ? "h-8 px-3 py-1.5 text-xs" : "h-8 w-8",
            md: children ? "h-10 px-3.5 py-2 text-sm" : "h-10 w-10",
            lg: children ? "h-12 px-5 py-3 text-base" : "h-12 w-12",
        };

        const variantClasses = {
            outline:
                "border border-border-l2 text-fg-primary hover:bg-button-ghost-hover [&_svg]:hover:text-fg-primary disabled:hover:bg-transparent",
            solid:
                "border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:hover:bg-blue-600",
            ghost:
                "border-transparent text-fg-primary hover:bg-button-ghost-hover disabled:hover:bg-transparent",
        };

        const sizeKey = size as "sm" | "md" | "lg";
        const variantKey = variant as "ghost" | "solid" | "outline";

        const allClasses = clsx(
            "inline-flex items-center justify-center gap-2",
            "whitespace-nowrap font-medium cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "transition-colors duration-100",
            "[&_svg]:shrink-0 select-none",
            rounded ? "rounded-full" : "rounded-md",
            "text-fg-primary",
            "relative overflow-hidden border",
            sizeClasses[sizeKey],
            variantClasses[variantKey],
            toggleGroup ? `group/${toggleGroup}` : "",
            className
        );

        const iconClasses = clsx(
            "stroke-[2]",
            "text-fg-secondary",
            "transition-colors duration-100"
        );

        let iconContent: React.ReactNode;
        if (loading) {
            iconContent = (
                <LucideIcon
                    name="Loader2"
                    size={iconSize}
                    className={clsx(iconClasses, "animate-spin")}
                />
            );
        } else if (typeof icon === "string") {
            iconContent = (
                <LucideIcon
                    name={icon}
                    size={iconSize}
                    strokeWidth={2}
                    className={iconClasses}
                />
            );
        } else {
            const CustomIcon = icon;
            iconContent = (
                <CustomIcon
                    size={iconSize}
                    strokeWidth={2}
                    className={iconClasses}
                />
            );
        }

        const buttonContent = (
            <>
                {iconContent}
                {children && <span className="text-fg-primary">{children}</span>}
            </>
        );

        const buttonNode = (
            <Component
                ref={ref}
                className={allClasses}
                disabled={disabled || loading}
                href={Component === "a" ? href : undefined}
                type={Component === "button" ? props.type || "button" : undefined}
                {...props}
            >
                {buttonContent}
            </Component>
        );

        if (tooltipContent) {
            return (
                <Tooltip.Provider>
                    <Tooltip.Root delayDuration={600} disableHoverableContent={true} {...tooltipProps}>
                        <Tooltip.Trigger asChild>{buttonNode}</Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content
                                side="bottom"
                                sideOffset={8}
                                {...tooltipContentProps}
                                className={clsx(
                                    "z-50 overflow-hidden rounded-md shadow-sm dark:shadow-none px-3 py-1.5 text-xs pointer-events-none",
                                    "animate-in fade-in-0 zoom-in-95",
                                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                                    "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                                    "bg-primary text-background",
                                    tooltipContentProps?.className
                                )}
                            >
                                {tooltipContent}
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                </Tooltip.Provider>
            );
        }

        return buttonNode;
    }
);

IconButton.displayName = "IconButton";
