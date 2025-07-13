/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { injectStyles } from "@utils/dom";
import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

export interface ToastProps {
    message: string;
    type?: "success" | "error" | "info" | "warning";
    duration?: number;
    className?: string;
    testID?: string;
}

export const Toast: React.FC<ToastProps> = ({
    message,
    type = "info",
    duration = 4000,
    className,
    testID,
}) => {
    const [visible, setVisible] = useState(true);
    const [mounted, setMounted] = useState(true);
    const toastRef = useRef<HTMLLIElement>(null);

    useEffect(() => {
        const css = `
            @keyframes sonner-fade-in {
                from { opacity: 0; transform: translateY(-10px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes sonner-fade-out {
                from { opacity: 1; transform: translateY(0) scale(1); }
                to { opacity: 0; transform: translateY(-10px) scale(0.95); }
            }
            [data-sonner-toast][data-visible="true"] {
                animation: sonner-fade-in 0.3s ease-out;
            }
            [data-sonner-toast][data-visible="false"] {
                animation: sonner-fade-out 0.3s ease-in;
            }
        `;
        const { cleanup } = injectStyles(css, `toast-styles-${Date.now()}`);
        const timer = setTimeout(() => {
            setVisible(false);
        }, duration);

        return () => {
            clearTimeout(timer);
            cleanup();
        };
    }, [duration]);

    useEffect(() => {
        if (!visible && toastRef.current) {
            const handleAnimationEnd = () => {
                setMounted(false);
            };
            toastRef.current.addEventListener("animationend", handleAnimationEnd);
            return () => {
                toastRef.current?.removeEventListener("animationend", handleAnimationEnd);
            };
        }
    }, [visible]);

    if (!mounted) {
        return null;
    }

    return (
        <li
            ref={toastRef}
            tabIndex={0}
            className={clsx(
                "group toast bg-popover rounded-2xl border-0 shadow-sm w-full sm:w-fit min-w-[200px] sm:max-w-md sm:mx-auto ring-1 ring-inset ring-input-border p-3.5 h-fit gap-3 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2",
                className
            )}
            data-sonner-toast=""
            data-styled="true"
            data-mounted="true"
            data-promise="false"
            data-swiped="false"
            data-removed={(!visible).toString()}
            data-visible={visible.toString()}
            data-y-position="top"
            data-x-position="center"
            data-index="0"
            data-front="true"
            data-swiping="false"
            data-dismissible="true"
            data-type={type}
            data-swipe-out="false"
            data-expanded="false"
            style={{
                "--index": "0",
                "--toasts-before": "0",
                "--z-index": "9999",
                "--offset": "32px",
                "--initial-height": "auto",
                "--swipe-amount": "0px",
                position: "fixed",
                top: "var(--offset)",
                zIndex: "var(--z-index)",
            } as React.CSSProperties}
            data-testid={testID}
        >
            {message}
        </li>
    );
};

Toast.displayName = "Toast";
