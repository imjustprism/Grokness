/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Lucide, type LucideIconName } from "@components/Lucide";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import React, { type ElementType, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

export interface DropdownMenuItem {
    label: React.ReactNode;
    icon?: LucideIconName;
    onSelect?: (event: Event) => void;
    disabled?: boolean;
}

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
    /**
     * @property {DropdownMenuItem[]} [dropdownItems] - If provided, the button will act as a dropdown trigger, displaying these items in a menu.
     */
    dropdownItems?: DropdownMenuItem[];
    /**
     * @property {'start' | 'center' | 'end'} [dropdownAlign='center'] - The alignment of the dropdown menu relative to the trigger.
     */
    dropdownAlign?: "start" | "center" | "end";
    /**
     * @property {boolean} [rotateIcon=false] - If true and dropdownItems is provided, rotates the icon when the dropdown is open.
     */
    rotateIcon?: boolean;
    /**
     * @property {boolean} [manualDropdown=false] - If true and dropdownItems is provided, uses manual fixed positioning for the dropdown (useful in transformed containers like modals).
     */
    manualDropdown?: boolean;
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

/**
 * A versatile and themeable button component with support for icons, different styles, sizes, and states.
 * It is built with accessibility in mind and can be wrapped in a tooltip or act as a dropdown menu.
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
            dropdownItems,
            dropdownAlign = "center",
            rotateIcon = false,
            manualDropdown = false,
            ...props
        },
        ref
    ) => {
        const [isHovered, setIsHovered] = useState(false);
        const [isOpen, setIsOpen] = useState(false);
        const buttonRef = useRef<HTMLElement>(null);
        const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number; } | null>(null);

        useLayoutEffect(() => {
            if (isOpen && manualDropdown && buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                let { left } = rect;
                if (dropdownAlign === "center") {
                    left += (rect.width / 2) - (200 / 2);
                } else if (dropdownAlign === "end") {
                    left += rect.width - 200;
                }
                setDropdownPosition({
                    top: rect.bottom + 8,
                    left,
                    width: rect.width,
                });
            }
        }, [isOpen, manualDropdown, dropdownAlign]);

        useEffect(() => {
            if (!manualDropdown || !isOpen) {
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
        }, [manualDropdown, isOpen]);

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

        const buttonNode = (
            <Component
                ref={composeRefs(ref, manualDropdown ? buttonRef : null)}
                className={finalClass}
                disabled={disabled || loading}
                aria-selected={isActive}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={manualDropdown && dropdownItems ? () => setIsOpen(prev => !prev) : props.onClick}
                {...props}
            >
                {leftIconNode}
                {children && <span className={textClasses}>{children}</span>}
                {rightIconNode}
            </Component>
        );

        const dropdownContentClass = clsx(
            "z-[1002] min-w-[12rem] overflow-hidden rounded-xl border border-border-l1 bg-surface-l1 p-1.5 shadow-lg",
            "animate-in fade-in-0 zoom-in-95"
        );

        const dropdownItemClass = clsx(
            "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm text-secondary outline-none transition-colors w-full",
            "hover:bg-button-ghost-hover hover:text-primary disabled:pointer-events-none disabled:opacity-50"
        );

        const renderDropdown = () => {
            if (!dropdownItems) {
                return buttonNode;
            }

            if (manualDropdown) {
                return (
                    <>
                        {buttonNode}
                        {isOpen && dropdownPosition && createPortal(
                            <div
                                data-dropdown-panel
                                style={{
                                    position: "fixed",
                                    top: `${dropdownPosition.top}px`,
                                    left: `${dropdownPosition.left}px`,
                                }}
                                className={dropdownContentClass}
                            >
                                {dropdownItems.map((item, index) => (
                                    <button
                                        key={index}
                                        onClick={e => {
                                            item.onSelect?.(e.nativeEvent);
                                            setIsOpen(false);
                                        }}
                                        disabled={item.disabled}
                                        className={dropdownItemClass}
                                    >
                                        {item.icon && <Lucide name={item.icon} className="mr-2 h-4 w-4" />}
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>,
                            document.body
                        )}
                    </>
                );
            } else {
                return (
                    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
                        <DropdownMenu.Trigger asChild>{buttonNode}</DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                side="bottom"
                                align={dropdownAlign}
                                sideOffset={8}
                                className={clsx(
                                    dropdownContentClass,
                                    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                                )}
                            >
                                {dropdownItems?.map((item, index) => (
                                    <DropdownMenu.Item
                                        key={index}
                                        onSelect={item.onSelect}
                                        disabled={item.disabled}
                                        className={dropdownItemClass}
                                    >
                                        {item.icon && <Lucide name={item.icon} className="mr-2 h-4 w-4" />}
                                        <span>{item.label}</span>
                                    </DropdownMenu.Item>
                                ))}
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                );
            }
        };

        const renderTooltip = (content: React.ReactNode) => (
            <Tooltip.Provider>
                <Tooltip.Root delayDuration={600}>
                    <Tooltip.Trigger asChild>{content}</Tooltip.Trigger>
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

        const content = dropdownItems ? renderDropdown() : buttonNode;

        return tooltip ? renderTooltip(content) : content;
    }
);

Button.displayName = "Button";
