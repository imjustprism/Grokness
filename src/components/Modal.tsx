/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { createFocusTrap } from "@utils/dom";
import clsx from "clsx";
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    /**
     * Determines if the modal is visible.
     */
    isOpen: boolean;
    /**
     * Callback invoked when the modal requests to close (via close button, ESC key, or overlay click).
     */
    onClose: () => void;
    /**
     * The title of the modal, which can be a string or a React node.
     */
    title?: string | React.ReactNode;
    /**
     * Optional descriptive text displayed below the title.
     */
    description?: string | React.ReactNode;
    /**
     * The main content of the modal.
     */
    children?: React.ReactNode;
    /**
     * Custom footer content, typically for action buttons.
     */
    footer?: React.ReactNode;
    /**
     * Whether to display a cancel button in the footer.
     * @default false
     */
    showCancel?: boolean;
    /**
     * Label for the cancel button.
     * @default "Cancel"
     */
    cancelLabel?: string;
    /**
     * Callback for the cancel button; defaults to onClose if not provided.
     */
    onCancel?: () => void;
    /**
     * ID for aria-describedby attribute for accessibility.
     */
    ariaDescribedBy?: string;
    /**
     * ID for aria-labelledby attribute for accessibility.
     */
    ariaLabelledBy?: string;
    /**
     * Maximum width of the modal content.
     * @default "max-w-[480px]"
     */
    maxWidth?: string;
    /**
     * Additional CSS classes for the modal content.
     */
    className?: string;
    /**
     * Whether clicking the overlay should close the modal.
     * @default true
     */
    closeOnOverlayClick?: boolean;
    /**
     * Renders the modal into a portal attached to the document body.
     * @default false
     */
    usePortal?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    children,
    footer,
    showCancel = false,
    cancelLabel = "Cancel",
    onCancel,
    ariaDescribedBy,
    ariaLabelledBy,
    maxWidth = "max-w-[480px]",
    className,
    closeOnOverlayClick = true,
    usePortal = false,
}) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const hasFocused = useRef(false);

    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("keydown", handleEscapeKey);
            if (!hasFocused.current && contentRef.current) {
                contentRef.current.focus();
                hasFocused.current = true;
            }
        } else {
            hasFocused.current = false;
        }

        return () => document.removeEventListener("keydown", handleEscapeKey);
    }, [isOpen, onClose]);

    useEffect(() => {
        let cleanupFocusTrap: (() => void) | undefined;

        if (isOpen && contentRef.current) {
            cleanupFocusTrap = createFocusTrap(contentRef.current);
        }

        return () => {
            cleanupFocusTrap?.();
        };
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleOverlayPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            event.preventDefault();
            if (closeOnOverlayClick) {
                onClose();
            }
        }
    };

    const modalNode = (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-[1000]"
            onPointerDown={handleOverlayPointerDown}
        >
            <div
                ref={contentRef}
                role="dialog"
                aria-modal="true"
                aria-describedby={ariaDescribedBy}
                aria-labelledby={ariaLabelledBy}
                data-state={isOpen ? "open" : "closed"}
                className={clsx(
                    "fixed left-[50%] top-[50%] z-[1001] translate-x-[-50%] translate-y-[-50%] bg-surface-base dark:border dark:border-border-l1 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
                    maxWidth,
                    "w-full p-4 rounded-3xl border border-border-l1 flex flex-col gap-4 overflow-hidden h-[640px] max-h-[85vh]",
                    className
                )}
                tabIndex={-1}
                style={{ pointerEvents: "auto" }}
            >
                <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                    <div className="flex w-full items-start justify-between">
                        <div className="flex-1">
                            {title && (
                                <h2 className="font-semibold text-lg" id={ariaLabelledBy}>
                                    {title}
                                </h2>
                            )}
                            {description && (
                                <div className="text-sm text-secondary mt-1" id={ariaDescribedBy}>
                                    {description}
                                </div>
                            )}
                        </div>
                        <Button
                            icon="X"
                            size="md"
                            variant="ghost"
                            iconSize={18}
                            onClick={onClose}
                            aria-label="Close dialog"
                            className="-mt-2 -mr-2 rounded-xl text-secondary hover:text-primary"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-3 -mr-3">{children}</div>
                {(footer || showCancel) && (
                    <div className="flex w-full items-center justify-end gap-2 pt-2">
                        {showCancel && (
                            <Button
                                variant="ghost"
                                onClick={onCancel || onClose}
                                size="md"
                            >
                                {cancelLabel}
                            </Button>
                        )}
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    if (usePortal) {
        return createPortal(modalNode, document.body);
    }

    return modalNode;
};
