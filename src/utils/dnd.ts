/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/logger";

const logger = new Logger("DnD", "#a0d2db");

/**
 * Result type for drag and drop operations.
 */
export type DnDResult<T = void> =
    | { readonly success: true; readonly data: T; }
    | { readonly success: false; readonly error: Error; };

/**
 * Enhanced MIME type validation.
 */
export function isValidMimeType(mime: string): mime is MimeType {
    return mime.startsWith("application/") || mime.startsWith("text/");
}

export type MimeType = `application/${string}` | `text/${string}`;

export type DragPayload = Readonly<Record<MimeType, string>>;

export interface DraggableOptions {
    readonly getPayload: (element: HTMLElement) => DragPayload | null;
    readonly ghost?: (element: HTMLElement) => HTMLElement;
    readonly hideCursor?: boolean;
    readonly onDragStart?: (event: DragEvent, element: HTMLElement) => void;
    readonly onDragEnd?: (event: DragEvent, element: HTMLElement) => void;
    readonly cursorOffset?: Readonly<{ x?: number; y?: number; }>;
    readonly ghostScale?: number;
}

export interface GhostOptions {
    readonly node: HTMLElement;
    readonly offsetX?: number;
    readonly offsetY?: number;
    readonly followCursor?: boolean;
    readonly scale?: number;
    readonly anchor?: "cursor" | "grab";
    readonly cursorOffset?: Readonly<{ x?: number; y?: number; }>;
}

export interface DropTargetOptions<T> {
    readonly canAccept: (types: ReadonlySet<string>, element: HTMLElement) => boolean;
    readonly extract: (data: DataTransfer) => T | null;
    readonly onEnter?: (event: DragEvent, element: HTMLElement) => void;
    readonly onOver?: (event: DragEvent, element: HTMLElement) => void;
    readonly onLeave?: (event: DragEvent, element: HTMLElement) => void;
    readonly onDrop: (data: T, element: HTMLElement, event: DragEvent) => void;
    readonly dropEffect?: DataTransfer["dropEffect"];
}

type Binding = {
    destroy: () => void;
};

const transparentPixel = (() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas;
})();

function applyGhostStyles(
    ghost: HTMLElement,
    { x, y, scale = 1 }: { x: number; y: number; scale?: number; }
) {
    ghost.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function createDragGhost(element: HTMLElement): HTMLElement {
    const ghost = document.createElement("div");
    const rect = element.getBoundingClientRect();

    ghost.className = "grokness-drag-ghost";
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;

    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.margin = "0";
    clone.style.width = "100%";
    clone.style.height = "100%";

    ghost.appendChild(clone);
    return ghost;
}

export function makeDraggable(
    element: HTMLElement,
    options: DraggableOptions
): DnDResult<Binding> {
    try {
        if (!element) {
            return { success: false, error: new Error("Element is required") };
        }
        if (!options?.getPayload) {
            return { success: false, error: new Error("getPayload function is required") };
        }

        let state: {
            ghost?: HTMLElement;
        } = {};

        const handleDragOver = (e: DragEvent) => {
            try {
                if (!state.ghost) {
                    return;
                }
                if (e.clientX === 0 && e.clientY === 0) {
                    return;
                }
                const x = e.clientX + (options.cursorOffset?.x ?? 0);
                const y = e.clientY + (options.cursorOffset?.y ?? 0);
                applyGhostStyles(state.ghost, { x, y, scale: options.ghostScale });
            } catch (error) {
                logger.error("Error in drag over handler:", error);
            }
        };

        const handleDragStart = (e: DragEvent) => {
            try {
                const payload = options.getPayload(element);
                if (!payload || !e.dataTransfer) {
                    return;
                }

                Object.entries(payload).forEach(([mime, value]) => {
                    try {
                        if (isValidMimeType(mime)) {
                            e.dataTransfer!.setData(mime, value);
                        } else {
                            logger.warn(`Invalid MIME type: ${mime}`);
                        }
                    } catch (err) {
                        logger.error(`Failed to set data for ${mime}:`, err);
                    }
                });

                const ghostBuilder = options.ghost ?? createDragGhost;
                const ghost = ghostBuilder(element);
                state.ghost = ghost;

                e.dataTransfer.setDragImage(transparentPixel, 0, 0);

                document.body.appendChild(ghost);
                const x = e.clientX + (options.cursorOffset?.x ?? 0);
                const y = e.clientY + (options.cursorOffset?.y ?? 0);
                applyGhostStyles(ghost, { x, y, scale: options.ghostScale });

                document.addEventListener("dragover", handleDragOver);

                options.onDragStart?.(e, element);
            } catch (error) {
                logger.error("Error in drag start handler:", error);
            }
        };

        const handleDragEnd = (e: DragEvent) => {
            try {
                document.removeEventListener("dragover", handleDragOver);
                state.ghost?.remove();
                state = {};
                options.onDragEnd?.(e, element);
            } catch (error) {
                logger.error("Error in drag end handler:", error);
            }
        };

        element.draggable = true;
        element.addEventListener("dragstart", handleDragStart);
        element.addEventListener("dragend", handleDragEnd);

        const binding: Binding = {
            destroy: () => {
                try {
                    element.draggable = false;
                    element.removeEventListener("dragstart", handleDragStart);
                    element.removeEventListener("dragend", handleDragEnd);
                    document.removeEventListener("dragover", handleDragOver);
                    state.ghost?.remove();
                    state = {};
                } catch (error) {
                    logger.error("Error destroying draggable:", error);
                }
            },
        };

        return { success: true, data: binding };
    } catch (error) {
        logger.error("Failed to make element draggable:", error);
        return { success: false, error: error as Error };
    }
}

/**
 * Legacy wrapper for backward compatibility.
 * @deprecated Use makeDraggable that returns DnDResult<Binding> instead
 */
export function makeDraggableUnsafe(
    element: HTMLElement,
    options: DraggableOptions
): Binding {
    const result = makeDraggable(element, options);
    if (!result.success) {
        throw result.error;
    }
    return result.data;
}

export function makeDropTarget<T>(
    element: HTMLElement,
    options: DropTargetOptions<T>
): DnDResult<Binding> {
    try {
        if (!element) {
            return { success: false, error: new Error("Element is required") };
        }
        if (!options?.canAccept) {
            return { success: false, error: new Error("canAccept function is required") };
        }
        if (!options?.extract) {
            return { success: false, error: new Error("extract function is required") };
        }
        if (!options?.onDrop) {
            return { success: false, error: new Error("onDrop function is required") };
        }

        const handleDragEnter = (e: DragEvent) => {
            try {
                if (!e.dataTransfer || !options.canAccept(new Set(e.dataTransfer.types), element)) {
                    return;
                }
                e.preventDefault();
                options.onEnter?.(e, element);
            } catch (error) {
                logger.error("Error in drag enter handler:", error);
            }
        };

        const handleDragOver = (e: DragEvent) => {
            try {
                if (!e.dataTransfer || !options.canAccept(new Set(e.dataTransfer.types), element)) {
                    return;
                }
                e.preventDefault();
                if (options.dropEffect) {
                    e.dataTransfer.dropEffect = options.dropEffect;
                }
                options.onOver?.(e, element);
            } catch (error) {
                logger.error("Error in drag over handler:", error);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            try {
                options.onLeave?.(e, element);
            } catch (error) {
                logger.error("Error in drag leave handler:", error);
            }
        };

        const handleDrop = (e: DragEvent) => {
            try {
                if (!e.dataTransfer || !options.canAccept(new Set(e.dataTransfer.types), element)) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();

                const data = options.extract(e.dataTransfer);
                if (data !== null) {
                    options.onDrop(data, element, e);
                }
            } catch (error) {
                logger.error("Error in drop handler:", error);
            }
        };

        element.addEventListener("dragenter", handleDragEnter);
        element.addEventListener("dragover", handleDragOver);
        element.addEventListener("dragleave", handleDragLeave);
        element.addEventListener("drop", handleDrop);

        const binding: Binding = {
            destroy: () => {
                try {
                    element.removeEventListener("dragenter", handleDragEnter);
                    element.removeEventListener("dragover", handleDragOver);
                    element.removeEventListener("dragleave", handleDragLeave);
                    element.removeEventListener("drop", handleDrop);
                } catch (error) {
                    logger.error("Error destroying drop target:", error);
                }
            },
        };

        return { success: true, data: binding };
    } catch (error) {
        logger.error("Failed to make drop target:", error);
        return { success: false, error: error as Error };
    }
}

/**
 * Legacy wrapper for backward compatibility.
 * @deprecated Use makeDropTarget that returns DnDResult<Binding> instead
 */
export function makeDropTargetUnsafe<T>(
    element: HTMLElement,
    options: DropTargetOptions<T>
): Binding {
    const result = makeDropTarget(element, options);
    if (!result.success) {
        throw result.error;
    }
    return result.data;
}

