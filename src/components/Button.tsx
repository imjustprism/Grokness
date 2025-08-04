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

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    as?: ElementType;
    children?: React.ReactNode;
    className?: string;
    variant?: "outline" | "solid" | "ghost";
    size?: "sm" | "md" | "lg" | "icon";
    color?: "default" | "danger" | "warning";
    rounded?: boolean;
    isActive?: boolean;
    loading?: boolean;
    icon?: LucideIconName | React.ComponentType<IconProps>;
    iconSize?: number;
    iconPosition?: "left" | "right";
    tooltip?: React.ReactNode;
    dropdownItems?: DropdownMenuItem[];
    dropdownAlign?: "start" | "center" | "end";
    rotateIcon?: boolean;
    manualDropdown?: boolean;
    disableIconHover?: boolean;
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
            dropdownAlign = "center",
            rotateIcon = false,
            manualDropdown = false,
            disableIconHover = false,
            ...props
        },
        ref
    ) => {
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
                setDropdownPosition({ top: rect.bottom + 8, left, width: rect.width });
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

        let iconClasses = "";
        if (isActive) {
            iconClasses = "text-primary";
        } else if (variant === "solid" && color !== "default") {
            iconClasses = "text-white";
        } else if (color === "danger") {
            iconClasses = "text-red-400 dark:text-red-200 group-hover:text-red-500";
        } else if (color === "warning") {
            iconClasses = "text-yellow-400 group-hover:text-yellow-500";
        } else {
            iconClasses = clsx("text-secondary", !disableIconHover && "group-hover:text-primary");
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

        const buttonNode = (
            <Component
                ref={composeRefs(ref, manualDropdown ? buttonRef : null)}
                className={finalClass}
                disabled={disabled || loading}
                aria-selected={isActive}
                onClick={manualDropdown && dropdownItems ? () => setIsOpen(prev => !prev) : props.onClick}
                {...props}
            >
                {leftIconNode}
                {children}
                {rightIconNode}
            </Component>
        );

        const renderDropdown = () => {
            if (!dropdownItems) {
                return buttonNode;
            }

            const dropdownContentClasses = "z-[1002] min-w-[12rem] overflow-hidden rounded-xl border border-border-l1 bg-surface-l1 p-1.5 shadow-lg animate-in fade-in-0 zoom-in-95";
            const dropdownItemClasses = "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm text-secondary outline-none transition-colors w-full hover:bg-button-ghost-hover hover:text-primary disabled:pointer-events-none disabled:opacity-50";

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
                                className={dropdownContentClasses}
                            >
                                {dropdownItems.map((item, index) => (
                                    <button
                                        key={index}
                                        onClick={e => {
                                            item.onSelect?.(e.nativeEvent);
                                            setIsOpen(false);
                                        }}
                                        disabled={item.disabled}
                                        className={dropdownItemClasses}
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
                                    dropdownContentClasses,
                                    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                                )}
                            >
                                {dropdownItems?.map((item, index) => (
                                    <DropdownMenu.Item
                                        key={index}
                                        onSelect={item.onSelect}
                                        disabled={item.disabled}
                                        className={dropdownItemClasses}
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

        const finalContent = dropdownItems ? renderDropdown() : buttonNode;

        return tooltip ? renderTooltip(finalContent) : finalContent;
    }
);

Button.displayName = "Button";
