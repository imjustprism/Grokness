/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/logger";

const logger = new Logger("DnD", "#a0d2db");

export type MimeType = `application/${string}` | `text/${string}`;

export type DragPayload = Readonly<Record<MimeType, string>>;

export interface DraggableOptions {
    getPayload: (element: HTMLElement) => DragPayload | null;
    ghost?: (element: HTMLElement) => HTMLElement;
    hideCursor?: boolean;
    onDragStart?: (event: DragEvent, element: HTMLElement) => void;
    onDragEnd?: (event: DragEvent, element: HTMLElement) => void;
    cursorOffset?: { x?: number; y?: number; };
    ghostScale?: number;
}

export interface GhostOptions {
    node: HTMLElement;
    offsetX?: number;
    offsetY?: number;
    followCursor?: boolean;
    scale?: number;
    anchor?: "cursor" | "grab";
    cursorOffset?: { x?: number; y?: number; };
}

export interface DropTargetOptions<T> {
    canAccept: (types: ReadonlySet<string>, element: HTMLElement) => boolean;
    extract: (data: DataTransfer) => T | null;
    onEnter?: (event: DragEvent, element: HTMLElement) => void;
    onOver?: (event: DragEvent, element: HTMLElement) => void;
    onLeave?: (event: DragEvent, element: HTMLElement) => void;
    onDrop: (data: T, element: HTMLElement, event: DragEvent) => void;
    dropEffect?: DataTransfer["dropEffect"];
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
): Binding {
    let state: {
        ghost?: HTMLElement;
    } = {};

    const handleDragOver = (e: DragEvent) => {
        if (!state.ghost) {
            return;
        }
        if (e.clientX === 0 && e.clientY === 0) {
            return;
        }
        const x = e.clientX + (options.cursorOffset?.x ?? 0);
        const y = e.clientY + (options.cursorOffset?.y ?? 0);
        applyGhostStyles(state.ghost, { x, y, scale: options.ghostScale });
    };

    const handleDragStart = (e: DragEvent) => {
        const payload = options.getPayload(element);
        if (!payload || !e.dataTransfer) {
            return;
        }

        Object.entries(payload).forEach(([mime, value]) => {
            try {
                e.dataTransfer!.setData(mime, value);
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
    };

    const handleDragEnd = (e: DragEvent) => {
        document.removeEventListener("dragover", handleDragOver);
        state.ghost?.remove();
        state = {};
        options.onDragEnd?.(e, element);
    };

    element.draggable = true;
    element.addEventListener("dragstart", handleDragStart);
    element.addEventListener("dragend", handleDragEnd);

    return {
        destroy: () => {
            element.draggable = false;
            element.removeEventListener("dragstart", handleDragStart);
            element.removeEventListener("dragend", handleDragEnd);
            document.removeEventListener("dragover", handleDragOver);
        },
    };
}

export function makeDropTarget<T>(
    element: HTMLElement,
    options: DropTargetOptions<T>
): Binding {
    const handleDragEnter = (e: DragEvent) => {
        if (!e.dataTransfer || !options.canAccept(new Set(e.dataTransfer.types), element)) {
            return;
        }
        e.preventDefault();
        options.onEnter?.(e, element);
    };

    const handleDragOver = (e: DragEvent) => {
        if (!e.dataTransfer || !options.canAccept(new Set(e.dataTransfer.types), element)) {
            return;
        }
        e.preventDefault();
        if (options.dropEffect) {
            e.dataTransfer.dropEffect = options.dropEffect;
        }
        options.onOver?.(e, element);
    };

    const handleDragLeave = (e: DragEvent) => {
        options.onLeave?.(e, element);
    };

    const handleDrop = (e: DragEvent) => {
        if (!e.dataTransfer || !options.canAccept(new Set(e.dataTransfer.types), element)) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();

        const data = options.extract(e.dataTransfer);
        if (data !== null) {
            options.onDrop(data, element, e);
        }
    };

    element.addEventListener("dragenter", handleDragEnter);
    element.addEventListener("dragover", handleDragOver);
    element.addEventListener("dragleave", handleDragLeave);
    element.addEventListener("drop", handleDrop);

    return {
        destroy: () => {
            element.removeEventListener("dragenter", handleDragEnter);
            element.removeEventListener("dragover", handleDragOver);
            element.removeEventListener("dragleave", handleDragLeave);
            element.removeEventListener("drop", handleDrop);
        },
    };
}

