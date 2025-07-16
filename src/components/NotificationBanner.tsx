/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import clsx from "clsx";
import React from "react";

/**
 * Props for the NotificationBanner component
 */
export interface NotificationBannerProps {
    /** The main title text of the notification */
    title: string;
    /** Descriptive text below the title */
    description: string;
    /** Text for the action button (optional) */
    actionText?: string;
    /** Callback function when action button is clicked */
    onAction?: () => void;
    /** Additional CSS classes to apply */
    className?: string;
    /** Visual variant of the notification */
    variant?: "warning" | "info" | "error";
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
    title,
    description,
    actionText,
    onAction,
    className,
    variant = "warning",
}) => {
    const variantStyles = {
        warning: "from-yellow-800/50 to-yellow-700/50 border-yellow-600",
        info: "from-blue-900/50 to-blue-800/50 border-blue-700",
        error: "from-red-900/50 to-red-800/50 border-red-700",
    };

    const buttonColor = variant === "error" ? "danger" : variant === "warning" ? "warning" : "default";

    return (
        <div className={clsx("w-full mb-6", className)}>
            <div
                className={clsx(
                    "flex items-center justify-between px-6 py-4",
                    "bg-gradient-to-r rounded-lg shadow-lg border",
                    variantStyles[variant]
                )}
            >
                <div className="flex flex-col gap-1">
                    <div className="text-white text-sm font-medium">
                        {title}
                    </div>
                    <div className="text-xs text-gray-400">{description}</div>
                </div>
                {actionText && onAction && (
                    <Button
                        onClick={onAction}
                        variant="outline"
                        color={buttonColor}
                    >
                        {actionText}
                    </Button>
                )}
            </div>
        </div>
    );
};
