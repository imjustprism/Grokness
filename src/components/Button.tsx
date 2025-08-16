/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DropdownMenu } from "@components/DropdownMenu";
import { Lucide, type LucideIconName } from "@components/Lucide";
import { Tooltip } from "@components/Tooltip";
import { Slot } from "@radix-ui/react-slot";
import clsx from "clsx";
import React, { type ElementType, useEffect, useRef, useState } from "react";

/**
 * @interface IconProps
 * @property {string} [className] - Optional class name(s) to apply on the icon.
 * @property {number} [size] - Size of the icon in pixels.
 * @property {number} [strokeWidth] - Stroke width for line icons, when supported.
 */
type IconProps = {
    /** Optional class name(s) to apply on the icon */
    className?: string;
    /** Size of the icon in pixels */
    size?: number;
    /** Stroke width for line icons, when supported */
    strokeWidth?: number;
};

/**
 * Item definition for Button dropdown menus
 */
export interface DropdownMenuItem {
    /** Visual label node */
    label: React.ReactNode;
    /** Value associated with the option */
    value: string;
    /** Optional Lucide icon to show to the left */
    icon?: LucideIconName;
    /** Selection handler for the item */
    onSelect?: (event: Event) => void;
    /** When true, the item is disabled and non-interactive */
    disabled?: boolean;
}

/**
 * @interface ButtonProps
 * @extends React.ButtonHTMLAttributes<HTMLButtonElement>
 * @property {ElementType} [as="button"] - Render as a different element/component.
 * @property {React.ReactNode} [children] - Button label/content.
 * @property {string} [className] - Additional class names.
 * @property {"outline" | "solid" | "ghost"} [variant="outline"] - Visual style.
 * @property {"sm" | "md" | "lg" | "icon"} [size="md"] - Button size.
 * @property {"default" | "danger" | "warning"} [color="default"] - Color intent.
 * @property {boolean} [rounded=false] - Rounded-full when true; otherwise rounded-xl.
 * @property {boolean} [isActive=false] - Visual active state.
 * @property {boolean} [loading=false] - Show loading spinner and disable interactions.
 * @property {LucideIconName | React.ComponentType<IconProps>} [icon] - Icon specification: Lucide icon name or custom component.
 * @property {number} [iconSize=18] - Icon size in pixels.
 * @property {"left" | "right"} [iconPosition="left"] - Icon placement.
 * @property {React.ReactNode} [tooltip] - Optional tooltip content.
 * @property {DropdownMenuItem[]} [dropdownItems] - Dropdown menu items; when provided, a dropdown-capable button is rendered.
 * @property {"start" | "center" | "end"} [dropdownAlign="center"] - Dropdown alignment relative to the trigger.
 * @property {boolean} [rotateIcon=false] - When true, rotate the icon on open/close.
 * @property {boolean} [disableIconHover=false] - Prevent icon color change on hover when true.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Render as a different element/component. If set to "slot", uses Radix Slot for composition */
    as?: ElementType | "slot";
    /** Button label/content */
    children?: React.ReactNode;
    /** Additional class names */
    className?: string;
    /** Visual style */
    variant?: "outline" | "solid" | "ghost";
    /** Button size */
    size?: "sm" | "md" | "lg" | "icon";
    /** Color intent */
    color?: "default" | "danger" | "warning";
    /** Rounded-full when true; otherwise rounded-xl */
    rounded?: boolean;
    /** Visual active state */
    isActive?: boolean;
    /** Show loading spinner and disable interactions */
    loading?: boolean;
    /** Icon specification: Lucide icon name or custom component */
    icon?: LucideIconName | React.ComponentType<IconProps>;
    /** Icon size in pixels */
    iconSize?: number;
    /** Icon placement */
    iconPosition?: "left" | "right";
    /** Optional tooltip content */
    tooltip?: React.ReactNode;
    /** Dropdown menu items; when provided, a dropdown-capable button is rendered */
    dropdownItems?: DropdownMenuItem[];
    /** When true, rotate the icon on open/close */
    rotateIcon?: boolean;
    /** Prevent icon color change on hover when true */
    disableIconHover?: boolean;
    /** Optional className override for icon element */
    iconClassName?: string;
}

const composeRefs = <T extends HTMLElement>(...refs: Array<React.Ref<T> | null>) => (el: T | null) => {
    refs.forEach(ref => {
        if (ref == null) {
            return;
        }
        if (typeof ref === "function") {
            ref(el);
        } else {
            (ref as React.MutableRefObject<T | null>).current = el;
        }
    });
};

export const Button = React.forwardRef<HTMLElement, ButtonProps>(
    (
        {
            as: Component = "button",
            children,
            className,
            variant = "outline",
            size = "md",
            color = "default",
            rounded = false,
            isActive = false,
            loading = false,
            icon,
            iconSize = 18,
            iconPosition = "left",
            tooltip,
            disabled,
            dropdownItems,
            rotateIcon = false,
            disableIconHover = false,
            iconClassName,
            ...props
        },
        ref
    ) => {
        const [isOpen, setIsOpen] = useState(false);
        const buttonRef = useRef<HTMLElement>(null);

        useEffect(() => {
            if (!dropdownItems || !isOpen) {
                return;
            }
            const handleClickOutside = (event: MouseEvent) => {
                const target = event.target as HTMLElement;
                if (buttonRef.current?.contains(target)) {
                    return;
                }
                if (target.closest("[data-dropdown-panel]")) {
                    return;
                }
                setIsOpen(false);
            };
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }, [dropdownItems, isOpen]);

        const baseClasses = [
            "inline-flex items-center gap-2",
            "whitespace-nowrap font-medium leading-[normal]",
            "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "transition-colors duration-100",
            "[&_svg]:shrink-0 select-none group",
        ];

        const sizeClasses = {
            sm: "h-8 px-3 text-xs",
            md: "h-10 px-4 py-2 text-sm",
            lg: "h-12 px-5 text-base",
            icon: "h-10 w-10 p-0",
        };

        const iconOnlySizeClasses = {
            sm: "h-8 w-8",
            md: "h-10 w-10",
            lg: "h-12 w-12",
            icon: "h-10 w-10",
        };

        const variantColorClasses = {
            solid: {
                default: "border-transparent bg-primary text-background hover:bg-primary/90",
                danger: "border-transparent bg-red-500 text-white hover:bg-red-600",
                warning: "border-transparent bg-yellow-500 text-white hover:bg-yellow-600",
            },
            outline: {
                default: `border-border-l2 text-fg-primary hover:bg-button-ghost-hover ${isActive ? "bg-button-ghost-hover text-primary" : ""}`,
                danger: `border-border-l2 text-red-400 hover:bg-red-400/10 dark:text-red-200 hover:text-red-500 ${isActive ? "bg-red-400/10" : ""}`,
                warning: `border-border-l2 text-yellow-400 hover:bg-yellow-400/10 ${isActive ? "bg-yellow-400/10" : ""}`,
            },
            ghost: {
                default: `border-transparent text-fg-primary hover:bg-button-ghost-hover ${isActive ? "bg-button-ghost-hover text-primary" : ""}`,
                danger: `border-transparent text-red-400 hover:bg-red-400/10 dark:text-red-200 hover:text-red-500 ${isActive ? "bg-red-400/10" : ""}`,
                warning: `border-transparent text-yellow-400 hover:bg-yellow-400/10 ${isActive ? "bg-yellow-400/10" : ""}`,
            },
        };

        const finalClass = clsx(
            baseClasses,
            sizeClasses[size],
            children ? "justify-start" : "justify-center",
            !children && iconOnlySizeClasses[size],
            variant !== "solid" && "border",
            rounded ? "rounded-full" : "rounded-xl",
            variantColorClasses[variant][color],
            className
        );

        let iconClasses = iconClassName || "";
        if (!iconClasses) {
            if (variant === "solid" && color !== "default") {
                iconClasses = "text-white";
            } else if (color === "danger") {
                iconClasses = "text-red-400 dark:text-red-200 group-hover:text-red-500";
            } else if (color === "warning") {
                iconClasses = "text-yellow-400 group-hover:text-yellow-500";
            } else if (isActive) {
                iconClasses = "text-primary";
            } else {
                iconClasses = clsx("text-secondary", !disableIconHover && "group-hover:text-primary");
            }
        }

        const iconNode = loading ? (
            <Lucide name="Loader2" size={iconSize} className={clsx("animate-spin", iconClasses)} />
        ) : icon && typeof icon === "string" ? (
            <Lucide name={icon} size={iconSize} className={iconClasses} />
        ) : icon ? (
            React.createElement(icon, { size: iconSize, className: iconClasses })
        ) : null;

        let leftIconNode = iconPosition === "left" ? iconNode : null;
        let rightIconNode = iconPosition === "right" ? iconNode : null;

        if (dropdownItems && rotateIcon && iconNode) {
            const wrapClass = clsx("transition-transform duration-200", isOpen && "rotate-180");
            const wrapper = (node: React.ReactNode, margin: string) => <div className={clsx(margin, wrapClass)}>{node}</div>;
            if (iconPosition === "left") {
                leftIconNode = wrapper(iconNode, "mr-2");
            } else if (iconPosition === "right") {
                rightIconNode = wrapper(iconNode, "ml-2");
            }
        }

        const Comp = (Component === "slot" ? Slot : Component) as ElementType;

        const buttonNode = (
            <Comp
                ref={composeRefs(ref, dropdownItems ? buttonRef : null)}
                className={finalClass}
                disabled={disabled || loading}
                aria-selected={isActive}
                onClick={dropdownItems ? () => setIsOpen(prev => !prev) : props.onClick}
                {...props}
            >
                {leftIconNode}
                {children}
                {rightIconNode}
            </Comp>
        );

        const finalContent = dropdownItems ? (
            <DropdownMenu
                options={dropdownItems}
                value={""}
                onChange={item => {
                    const selected = dropdownItems.find(
                        d => d.label === item
                    );
                    selected?.onSelect?.(new Event("select"));
                }}
            >
                {buttonNode}
            </DropdownMenu>
        ) : (
            buttonNode
        );

        return tooltip ? (
            <Tooltip content={tooltip}>{finalContent}</Tooltip>
        ) : (
            finalContent
        );
    }
);

Button.displayName = "Button";
