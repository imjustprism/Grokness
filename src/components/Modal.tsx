/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { ScrollArea } from "@components/ScrollArea";
import clsx from "clsx";
import React, {
    forwardRef,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
} from "react";
import { createPortal } from "react-dom";

/**
 * @interface ModalProps
 * @property {boolean} isOpen - Determines if the modal is visible.
 * @property {() => void} onClose - Callback invoked when the modal requests to close.
 * @property {string | React.ReactNode} [title] - The title of the modal.
 * @property {string | React.ReactNode} [description] - Optional descriptive text displayed below the title.
 * @property {React.ReactNode} [children] - The main content of the modal.
 * @property {React.ReactNode} [footer] - Custom footer content.
 * @property {boolean} [showCancel=false] - Whether to display a cancel button in the footer.
 * @property {string} [cancelLabel="Cancel"] - Label for the cancel button.
 * @property {() => void} [onCancel] - Callback for the cancel button.
 * @property {string} [ariaDescribedBy] - ID for aria-describedby attribute.
 * @property {string} [ariaLabelledBy] - ID for aria-labelledby attribute.
 * @property {string} [ariaLabel] - aria-label for the dialog.
 * @property {string} [maxWidth="max-w-[480px]"] - Maximum width Tailwind class for the modal content.
 * @property {string} [className] - Additional CSS classes for the modal content.
 * @property {string} [overlayClassName] - Overlay container class override.
 * @property {string} [contentClassName] - Content wrapper class override.
 * @property {boolean} [closeOnOverlayClick=true] - Whether clicking the overlay should close the modal.
 * @property {boolean} [closeOnEsc=true] - Whether pressing Escape should close the modal.
 * @property {boolean} [trapFocus=true] - Trap focus within the modal while open.
 * @property {boolean} [autoFocus=true] - Auto focus the dialog or provided initial focus ref on open.
 * @property {React.RefObject<HTMLElement>} [initialFocusRef] - Optional element to receive initial focus when opening.
 * @property {boolean} [preventScroll=true] - Prevent body scroll while the modal is open.
 * @property {boolean} [usePortal=false] - Renders the modal into a portal attached to the document body.
 * @property {Element | DocumentFragment | null} [portalContainer] - Portal container target when `usePortal` is true.
 * @property {(event: KeyboardEvent) => void} [onEscapeKeyDown] - Callback for advanced control over the escape key press.
 * @property {(event: React.PointerEvent<HTMLDivElement>) => void} [onOverlayClick] - Callback for advanced control over the overlay click.
 */
export interface ModalProps {
    /** Determines if the modal is visible. */
    isOpen: boolean;
    /** Callback invoked when the modal requests to close (via close button, ESC key, or overlay click). */
    onClose: () => void;
    /** The title of the modal, which can be a string or a React node. */
    title?: string | React.ReactNode;
    /** Optional descriptive text displayed below the title. */
    description?: string | React.ReactNode;
    /** The main content of the modal. */
    children?: React.ReactNode;
    /** Custom footer content, typically for action buttons. */
    footer?: React.ReactNode;
    /** Whether to display a cancel button in the footer. @default false */
    showCancel?: boolean;
    /** Label for the cancel button. @default "Cancel" */
    cancelLabel?: string;
    /** Callback for the cancel button; defaults to onClose if not provided. */
    onCancel?: () => void;
    /** ID for aria-describedby attribute for accessibility. If omitted and description is provided, one is auto-generated. */
    ariaDescribedBy?: string;
    /** ID for aria-labelledby attribute for accessibility. If omitted and title is provided, one is auto-generated. */
    ariaLabelledBy?: string;
    /** When provided, aria-label is applied on the dialog. Used when no visible title. */
    ariaLabel?: string;
    /** Maximum width Tailwind class for the modal content. @default "max-w-[480px]" */
    maxWidth?: string;
    /** Additional CSS classes for the modal content. */
    className?: string;
    /** Overlay container class override. */
    overlayClassName?: string;
    /** Content wrapper class override. */
    contentClassName?: string;
    /** Whether clicking the overlay should close the modal. @default true */
    closeOnOverlayClick?: boolean;
    /** Whether pressing Escape should close the modal. @default true */
    closeOnEsc?: boolean;
    /** Trap focus within the modal while open. @default true */
    trapFocus?: boolean;
    /** Auto focus the dialog or provided initial focus ref on open. @default true */
    autoFocus?: boolean;
    /** Optional element to receive initial focus when opening. */
    initialFocusRef?: React.RefObject<HTMLElement>;
    /** Prevent body scroll while the modal is open. @default true */
    preventScroll?: boolean;
    /** Renders the modal into a portal attached to the document body. @default false */
    usePortal?: boolean;
    /** Portal container target when `usePortal` is true. Defaults to document.body. */
    portalContainer?: Element | DocumentFragment | null;
    /** Callbacks for advanced control */
    onEscapeKeyDown?: (event: KeyboardEvent) => void;
    onOverlayClick?: (event: React.PointerEvent<HTMLDivElement>) => void;
}

function createFocusTrap(container: HTMLElement): () => void {
    const FOCUSABLE =
        'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [contenteditable], [tabindex]:not([tabindex="-1"])';

    const getFocusable = (): HTMLElement[] =>
        Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
            .filter(el => !el.hasAttribute("inert") && el.offsetParent !== null);

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "Tab") {
            return;
        }
        const focusables = getFocusable();
        if (focusables.length === 0) {
            e.preventDefault();
            container.focus();
            return;
        }
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
            if (!active || active === first || !container.contains(active)) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (!active || active === last || !container.contains(active)) {
                e.preventDefault();
                first.focus();
            }
        }
    };

    const onFocusIn = (e: FocusEvent) => {
        if (!container.contains(e.target as Node)) {
            const focusables = getFocusable();
            (focusables[0] ?? container).focus();
        }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);

    const initialTargets = getFocusable();
    (initialTargets[0] ?? container).focus();

    return () => {
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("focusin", onFocusIn, true);
        previouslyFocused?.focus?.();
    };
}

type ModalContextValue = { close: () => void; };

const ModalContext = React.createContext<ModalContextValue | null>(null);

const OVERLAY_BASE_CLASSES = "fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-[1000]";
const CONTENT_BASE_CLASSES = "fixed left-[50%] top-[50%] z-[1001] translate-x-[-50%] translate-y-[-50%] bg-surface-base dark:border dark:border-border-l1 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]";
const CONTENT_LAYOUT_CLASSES = "w-full pl-4 pr-0 py-4 rounded-3xl border border-border-l1 flex flex-col gap-4 overflow-hidden h-[640px] max-h-[85vh]";

type ModalStaticComponents = {
    Header: React.FC<{ children?: React.ReactNode; }>;
    Title: React.FC<{ id?: string; children?: React.ReactNode; }>;
    Description: React.FC<{ id?: string; children?: React.ReactNode; }>;
    Body: React.FC<{ children?: React.ReactNode; className?: string; }>;
    Footer: React.FC<{ children?: React.ReactNode; className?: string; }>;
    CloseButton: (props: Omit<React.ComponentProps<typeof Button>, "onClick" | "icon">) => React.ReactElement;
};

type ModalComponent = React.ForwardRefExoticComponent<React.PropsWithoutRef<ModalProps> & React.RefAttributes<HTMLDivElement>> & ModalStaticComponents;

export const Modal: ModalComponent = Object.assign(
    forwardRef<HTMLDivElement, ModalProps>(({
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
        ariaLabel,
        maxWidth = "max-w-[480px]",
        className,
        overlayClassName,
        contentClassName,
        closeOnOverlayClick = true,
        closeOnEsc = true,
        trapFocus = true,
        autoFocus = true,
        initialFocusRef,
        preventScroll = true,
        usePortal = false,
        portalContainer,
        onEscapeKeyDown,
        onOverlayClick,
    }, ref) => {
        const contentRef = useRef<HTMLDivElement>(null);
        const setRef = useCallback(<T extends unknown>(r: React.Ref<T> | undefined, value: T | null) => {
            if (typeof r === "function") {
                r(value);
            } else if (r != null) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (r as any).current = value;
            }
        }, []);
        const handleContentRef = useCallback((node: HTMLDivElement | null) => {
            contentRef.current = node;
            setRef(ref, node);
        }, [ref, setRef]);

        const hasFocused = useRef(false);
        const pointerDownTargetRef = useRef<EventTarget | null>(null);
        const autoIds = {
            titleId: useId(),
            descriptionId: useId(),
        };

        useEffect(() => {
            if (!isOpen || !preventScroll) {
                return;
            }
            const { body } = document;
            const prev = body.style.overflow;
            body.style.overflow = "hidden";
            return () => {
                body.style.overflow = prev;
            };
        }, [isOpen, preventScroll]);

        useEffect(() => {
            const handleEscapeKey = (event: KeyboardEvent) => {
                if (event.key !== "Escape") {
                    return;
                }
                onEscapeKeyDown?.(event);
                if (!closeOnEsc) {
                    return;
                }
                event.preventDefault();
                onClose();
            };
            if (isOpen) {
                document.addEventListener("keydown", handleEscapeKey);
                if (autoFocus && !hasFocused.current) {
                    const target = initialFocusRef?.current ?? contentRef.current;
                    target?.focus?.();
                    hasFocused.current = true;
                }
            } else {
                hasFocused.current = false;
            }
            return () => document.removeEventListener("keydown", handleEscapeKey);
        }, [isOpen, onClose, closeOnEsc, autoFocus, initialFocusRef, onEscapeKeyDown]);

        useEffect(() => {
            let cleanupFocusTrap: (() => void) | undefined;
            if (isOpen && trapFocus && contentRef.current) {
                cleanupFocusTrap = createFocusTrap(contentRef.current);
            }
            return () => {
                cleanupFocusTrap?.();
            };
        }, [isOpen, trapFocus]);

        const resolvedAriaLabelledBy = useMemo(() => {
            if (ariaLabelledBy) {
                return ariaLabelledBy;
            }
            return title ? autoIds.titleId : undefined;
        }, [ariaLabelledBy, title, autoIds.titleId]);

        const resolvedAriaDescribedBy = useMemo(() => {
            if (ariaDescribedBy) {
                return ariaDescribedBy;
            }
            return description ? autoIds.descriptionId : undefined;
        }, [ariaDescribedBy, description, autoIds.descriptionId]);

        const handleOverlayPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
            pointerDownTargetRef.current = event.target;
        }, []);

        const handleOverlayPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
            onOverlayClick?.(event);
            if (event.currentTarget !== event.target) {
                return;
            }
            if (pointerDownTargetRef.current !== event.target) {
                return;
            }
            if (closeOnOverlayClick) {
                onClose();
            }
        }, [closeOnOverlayClick, onClose, onOverlayClick]);

        if (!isOpen) {
            return null;
        }

        const modalNode = (
            <ModalContext.Provider value={{ close: onClose }}>
                <div
                    className={clsx(OVERLAY_BASE_CLASSES, overlayClassName)}
                    onPointerDown={handleOverlayPointerDown}
                    onPointerUp={handleOverlayPointerUp}
                >
                    <div
                        ref={handleContentRef}
                        role="dialog"
                        aria-modal="true"
                        aria-describedby={resolvedAriaDescribedBy}
                        aria-labelledby={resolvedAriaLabelledBy}
                        aria-label={ariaLabel}
                        data-state={isOpen ? "open" : "closed"}
                        className={clsx(
                            CONTENT_BASE_CLASSES,
                            maxWidth,
                            CONTENT_LAYOUT_CLASSES,
                            className,
                            contentClassName,
                        )}
                        tabIndex={-1}
                        style={{ pointerEvents: "auto" }}
                    >
                        <div className="flex flex-col space-y-1.5 text-center sm:text-left pr-4">
                            <div className="flex w-full items-start justify-between">
                                <div className="flex-1">
                                    {title && (
                                        <h2 className="font-semibold text-lg" id={resolvedAriaLabelledBy}>
                                            {title}
                                        </h2>
                                    )}
                                    {description && (
                                        <div className="text-sm text-secondary mt-1" id={resolvedAriaDescribedBy}>
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
                                    className="-mt-2 rounded-xl text-secondary hover:text-primary"
                                />
                            </div>
                        </div>
                        <ScrollArea className="flex-1 pr-4">{children}</ScrollArea>
                        {(footer || showCancel) && (
                            <div className="flex w-full items-center justify-end gap-2 pt-2 pr-4">
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
            </ModalContext.Provider>
        );

        if (usePortal) {
            return createPortal(modalNode, portalContainer ?? document.body);
        }

        return modalNode;
    }),
    {
        Header: ({ children }: { children?: React.ReactNode; }) => (
            <div className="flex flex-col space-y-1.5 text-center sm:text-left pr-4">{children}</div>
        ),
        Title: ({ id, children }: { id?: string; children?: React.ReactNode; }) => (
            <h2 id={id} className="font-semibold text-lg">{children}</h2>
        ),
        Description: ({ id, children }: { id?: string; children?: React.ReactNode; }) => (
            <div id={id} className="text-sm text-secondary mt-1">{children}</div>
        ),
        Body: ({ children, className }: { children?: React.ReactNode; className?: string; }) => (
            <ScrollArea className={clsx("flex-1", className)}>{children}</ScrollArea>
        ),
        Footer: ({ children, className }: { children?: React.ReactNode; className?: string; }) => (
            <div className={clsx("flex w-full items-center justify-end gap-2 pt-2 pr-4", className)}>{children}</div>
        ),
        CloseButton: (props: Omit<React.ComponentProps<typeof Button>, "onClick" | "icon">) => {
            const ctx = useContext(ModalContext);
            return (
                <Button
                    icon="X"
                    variant="ghost"
                    iconSize={18}
                    aria-label="Close dialog"
                    className={clsx("-mt-2 rounded-xl text-secondary hover:text-primary", props.className)}
                    onClick={ctx?.close}
                    {...props}
                />
            );
        },
    }
) as ModalComponent;
