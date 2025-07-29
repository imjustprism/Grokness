/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Lucide, type LucideIconName } from "@components/Lucide";
import * as Tooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import React, { type ElementType, useState } from "react";

/**
 * @typedef {object} IconProps - Properties for a custom icon component.
 * @property {string} [className] - Additional CSS classes for the icon.
 * @property {number} [size] - The size of the icon in pixels.
 * @property {number} [strokeWidth] - The stroke width of the icon.
 */
type IconProps = {
    className?: string;
    size?: number;
    strokeWidth?: number;
};

/**
 * @interface ButtonProps
 * @extends React.ButtonHTMLAttributes<HTMLButtonElement>
 * @description Defines the props for the Button component.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * @property {ElementType} [as="button"] - The HTML element or React component to render as.
     * @example <Button as="a" href="/link">Link Button</Button>
     */
    as?: ElementType;
    /**
     * @property {React.ReactNode} [children] - The content to be displayed inside the button.
     */
    children?: React.ReactNode;
    /**
     * @property {string} [className] - Additional CSS classes to apply to the button.
     */
    className?: string;
    /**
     * @property {"outline" | "solid" | "ghost"} [variant="outline"] - The visual style of the button.
     */
    variant?: "outline" | "solid" | "ghost";
    /**
     * @property {"sm" | "md" | "lg" | "icon"} [size="md"] - The size of the button. 'icon' is for buttons that only contain an icon.
     */
    size?: "sm" | "md" | "lg" | "icon";
    /**
     * @property {"default" | "danger" | "warning"} [color="default"] - The color scheme of the button, affecting text, icons, and hover states.
     */
    color?: "default" | "danger" | "warning";
    /**
     * @property {boolean} [rounded=true] - If true, the button will have fully rounded corners. If false, it will have slightly rounded corners.
     */
    rounded?: boolean;
    /**
     * @property {boolean} [isActive=false] - If true, applies an active state style to the button.
     */
    isActive?: boolean;
    /**
     * @property {boolean} [loading=false] - If true, displays a loading spinner instead of the icon and disables the button.
     */
    loading?: boolean;
    /**
     * @property {LucideIconName | React.ComponentType<IconProps>} [icon] - The icon to display. Can be a string name from Lucide icons or a custom React component.
     */
    icon?: LucideIconName | React.ComponentType<IconProps>;
    /**
     * @property {number} [iconSize=18] - The size of the icon in pixels.
     */
    iconSize?: number;
    /**
     * @property {"left" | "right"} [iconPosition="left"] - The position of the icon relative to the children content.
     */
    iconPosition?: "left" | "right";
    /**
     * @property {React.ReactNode} [tooltip] - If provided, wraps the button in a tooltip that shows this content on hover.
     */
    tooltip?: React.ReactNode;
}

/**
 * A versatile and themeable button component with support for icons, different styles, sizes, and states.
 * It is built with accessibility in mind and can be wrapped in a tooltip.
 *
 * @param {ButtonProps} props - The properties for the Button component.
 * @param {React.Ref<HTMLElement>} ref - Forwarded ref to the underlying button element.
 * @returns {React.ReactElement} The rendered button component.
 */
export const Button = React.forwardRef<HTMLElement, ButtonProps>(
    (
        {
            as: Component = "button",
            children,
            className,
            variant = "outline",
            size = "md",
            color = "default",
            rounded = true,
            isActive = false,
            loading = false,
            icon,
            iconSize = 18,
            iconPosition = "left",
            tooltip,
            disabled,
            ...props
        },
        ref
    ) => {
        /**
         * State to track hover status. This is used to programmatically change the icon color,
         * avoiding CSS specificity issues with nested hover selectors from parent elements.
         */
        const [isHovered, setIsHovered] = useState(false);

        const baseClasses = [
            "inline-flex items-center gap-2",
            "whitespace-nowrap font-medium cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "transition-colors duration-100",
            "[&_svg]:shrink-0 select-none border",
        ];

        const sizeClasses = {
            sm: "h-8 px-3 text-xs",
            md: "h-10 px-3.5 text-sm",
            lg: "h-12 px-5 text-base",
            icon: "p-0",
        };

        const iconOnlySizeClasses = {
            sm: "h-8 w-8",
            md: "h-10 w-10",
            lg: "h-12 w-12",
            icon: "h-10 w-10",
        };

        const variantClasses = {
            outline: "border-border-l2",
            solid: "border-transparent",
            ghost: "border-transparent",
        };

        const containerStateClasses = {
            default: "hover:bg-button-ghost-hover",
            danger: "hover:bg-red-400/10",
            warning: "hover:bg-yellow-400/10",
        };

        let textClasses = "";
        let iconClasses = "";

        if (isActive) {
            textClasses = "text-primary";
            iconClasses = "text-primary";
        } else {
            switch (color) {
                case "danger":
                    textClasses = "text-red-400 dark:text-red-200";
                    iconClasses = "text-red-400 dark:text-red-200";
                    break;
                case "warning":
                    textClasses = "text-yellow-400 dark:text-yellow-200";
                    iconClasses = "text-yellow-400 dark:text-yellow-200";
                    break;
                case "default":
                default:
                    textClasses = "text-fg-primary";
                    iconClasses = isHovered && !disabled ? "text-primary" : "text-secondary";
                    break;
            }
        }

        const activeContainerClasses = isActive ? "bg-button-ghost-hover" : "";

        const finalClass = clsx(
            baseClasses,
            rounded ? "rounded-full" : "rounded-xl",
            sizeClasses[size],
            children ? "justify-start" : ["justify-center", iconOnlySizeClasses[size]],
            variantClasses[variant],
            !isActive && containerStateClasses[color],
            activeContainerClasses,
            className
        );

        const iconNode = loading ? (
            <Lucide name="Loader2" size={iconSize} className={clsx(iconClasses, "animate-spin")} />
        ) : icon && typeof icon === "string" ? (
            <Lucide name={icon} size={iconSize} className={iconClasses} />
        ) : icon ? (
            React.createElement(icon, { size: iconSize, className: iconClasses })
        ) : null;

        const buttonNode = (
            <Component
                ref={ref}
                className={finalClass}
                disabled={disabled || loading}
                aria-selected={isActive}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                {...props}
            >
                {iconPosition === "left" && iconNode}
                {children && <span className={textClasses}>{children}</span>}
                {iconPosition === "right" && iconNode}
            </Component>
        );

        if (tooltip) {
            return (
                <Tooltip.Provider>
                    <Tooltip.Root delayDuration={600}>
                        <Tooltip.Trigger asChild>{buttonNode}</Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content
                                side="bottom"
                                sideOffset={8}
                                className={clsx(
                                    "z-50 overflow-hidden rounded-md shadow-sm dark:shadow-none px-3 py-1.5 text-xs pointer-events-none",
                                    "animate-in fade-in-0 zoom-in-95 bg-primary text-background"
                                )}
                            >
                                {tooltip}
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                </Tooltip.Provider>
            );
        }

        return buttonNode;
    }
);

Button.displayName = "Button";
