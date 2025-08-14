/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Lucide, type LucideIconName } from "@components/Lucide";
import * as RadixToast from "@radix-ui/react-toast";
import clsx from "clsx";
import React from "react";

export type ToastIntent = "default" | "info" | "warning" | "error" | "success";

const defaultIconByIntent: Record<ToastIntent, LucideIconName> = {
    default: "Bell",
    info: "Info",
    warning: "TriangleAlert",
    error: "AlertCircle",
    success: "CheckCircle2",
};

/**
 * @interface ToastProviderProps
 * @property {number} [duration=5000] - Default auto-dismiss duration in ms, can be overridden per toast.
 * @property {React.ReactNode} [children] - Children of the provider.
 * @property {string} [viewportClassName] - Additional classes for the viewport container.
 */
export interface ToastProviderProps {
    /** Default auto-dismiss duration in ms, can be overridden per toast. */
    duration?: number;
    /** Children of the provider. */
    children?: React.ReactNode;
    /** Additional classes for the viewport container. */
    viewportClassName?: string;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
    duration = 5000,
    children,
    viewportClassName,
}) => (
    <RadixToast.Provider duration={duration} swipeDirection="up">
        {children}
        <RadixToast.Viewport
            className={clsx(
                "fixed top-4 right-1/2 translate-x-1/2 z-[9999]",
                "flex flex-col gap-2 p-0 m-0 list-none",
                "outline-none",
                "pointer-events-none",
                viewportClassName,
            )}
        />
    </RadixToast.Provider>
);

/**
 * @interface ToastProps
 * @property {boolean} open - Controlled visibility.
 * @property {(open: boolean) => void} onOpenChange - Visibility state change handler.
 * @property {React.ReactNode} [message] - Main message content. If both are provided, `children` takes precedence.
 * @property {React.ReactNode} [children] - Alternative way to pass message content.
 * @property {ToastIntent} [intent="warning"] - Visual intent for icon and semantics.
 * @property {LucideIconName | React.ReactNode | false} [icon] - Provide a custom icon, a Lucide icon name, or `false` to hide.
 * @property {number} [duration] - Auto-dismiss duration in ms (overrides provider).
 * @property {boolean} [dismissible=true] - When true, a close button is rendered.
 * @property {string} [className] - Additional classes for the toast surface.
 * @property {"polite" | "assertive" | "off"} [ariaLive="polite"] - aria-live politeness.
 * @property {"status" | "alert" | "none"} [ariaRole] - Role override. Defaults to `alert` for error, else `status`.
 * @property {string} [closeButtonAriaLabel="Dismiss notification"] - Accessible label for the close button.
 */
export interface ToastProps {
    /** Controlled visibility. */
    open: boolean;
    /** Visibility state change handler. */
    onOpenChange: (open: boolean) => void;
    /** Main message content. If both are provided, `children` takes precedence. */
    message?: React.ReactNode;
    /** Alternative way to pass message content. */
    children?: React.ReactNode;
    /** Visual intent for icon and semantics. */
    intent?: ToastIntent;
    /** Provide a custom icon, a Lucide icon name, or `false` to hide. */
    icon?: LucideIconName | React.ReactNode | false;
    /** Auto-dismiss duration in ms (overrides provider). */
    duration?: number;
    /** When true, a close button is rendered. @default true */
    dismissible?: boolean;
    /** Additional classes for the toast surface. */
    className?: string;
    /** aria-live politeness. @default polite */
    ariaLive?: "polite" | "assertive" | "off";
    /** Role override. Defaults to `alert` for error, else `status`. */
    ariaRole?: "status" | "alert" | "none";
    /** Accessible label for the close button. */
    closeButtonAriaLabel?: string;
}

export const Toast: React.FC<ToastProps> = ({
    open,
    onOpenChange,
    message,
    children,
    intent = "warning",
    icon,
    duration,
    dismissible = true,
    className,
    ariaLive = "polite",
    ariaRole,
    closeButtonAriaLabel = "Dismiss notification",
}) => {
    const resolvedRole = ariaRole ?? (intent === "error" ? "alert" : "status");

    const iconNode = icon === false
        ? null
        : React.isValidElement(icon)
            ? icon
            : (
                <Lucide
                    name={(icon as LucideIconName) || defaultIconByIntent[intent]}
                    size={20}
                    className="me-0.5 flex-shrink-0"
                />
            );

    return (
        <RadixToast.Root
            open={open}
            onOpenChange={onOpenChange}
            duration={duration}
            role={resolvedRole}
            aria-live={ariaLive}
            className={clsx(
                "bg-popover rounded-2xl ring-1 ring-inset ring-toggle-border",
                "flex flex-row items-center gap-3",
                "mx-0 py-3 pl-4 pr-3 min-w-[300px] max-w-full lg:max-w-3/5 w-fit",
                "pointer-events-auto",
                "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
                "antialiased text-sm leading-[normal] font-normal",
                className,
            )}
        >
            {iconNode}
            <RadixToast.Description asChild>
                <div className="whitespace-pre-wrap text-fg-primary">
                    {children ?? message}
                </div>
            </RadixToast.Description>
            {dismissible ? (
                <RadixToast.Close asChild>
                    <Button
                        aria-label={closeButtonAriaLabel}
                        variant="ghost"
                        size="sm"
                        icon="X"
                        iconSize={18}
                        className="ms-auto rounded-lg text-sm text-fg-secondary hover:text-fg-primary"
                    />
                </RadixToast.Close>
            ) : null}
        </RadixToast.Root>
    );
};

Toast.displayName = "Toast";

export default Toast;

