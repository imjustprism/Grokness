/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type AnySelector, selectOne } from "@utils/dom";
import { Logger } from "@utils/logger";

/**
 * All browser event names, as taken from DocumentEventMap, for strong typing.
 */
export type GuardEventName = keyof DocumentEventMap;

/**
 * Curated groups of common event sets for convenience.
 */
export const EventGroups = Object.freeze({
    pointer: [
        "pointerdown",
        "pointerup",
        "pointermove",
        "pointercancel",
        "pointerenter",
        "pointerleave",
        "pointerover",
        "pointerout",
    ] as GuardEventName[],
    mouse: [
        "mousedown",
        "mouseup",
        "mousemove",
        "mouseenter",
        "mouseleave",
        "mouseover",
        "mouseout",
        "click",
        "dblclick",
        "contextmenu",
    ] as GuardEventName[],
    touch: [
        "touchstart",
        "touchend",
        "touchmove",
        "touchcancel",
    ] as GuardEventName[],
    keyboard: [
        "keydown",
        "keyup",
        "keypress",
    ] as GuardEventName[],
    wheel: ["wheel"] as GuardEventName[],
    dragDrop: [
        "dragstart",
        "drag",
        "dragend",
        "dragenter",
        "dragleave",
        "dragover",
        "drop",
    ] as GuardEventName[],
});

/**
 * How to stop event propagation.
 */
export type StopPropagationStrategy = "none" | "stop" | "stopImmediate";

/**
 * Strategy to prevent default behavior.
 */
export type PreventDefaultStrategy = "always" | "never" | "auto";

/**
 * A specification for which nodes to guard.
 */
export interface TargetQuerySpec {
    /**
     * Roots to search under. Each entry can be an actual node or an AnySelector.
     * When empty, defaults to [document].
     */
    roots?: (ParentNode | AnySelector)[];
    /**
     * Additional scoping selector applied within each resolved root before searching targets.
     */
    scope?: AnySelector;
    /** Selectors for elements to guard (any match among them is guarded). */
    selectors: string[];
    /** Optional filter run for each candidate element to include/exclude it. */
    filter?: (el: HTMLElement) => boolean;
}

/**
 * Optional style adjustments applied to target elements when the guard is enabled.
 */
export interface GuardStyleAdjustments {
    cursor?: string;
    addClass?: string;
    attributes?: Readonly<Record<string, string>>;
}

/**
 * Core guard behavior configuration.
 */
export interface GuardBehavior {
    events: GuardEventName[];
    capture?: boolean;
    passive?: boolean;
    once?: boolean;
    /**
     * Allow the event if the event.target or any ancestor matches one of these selectors.
     */
    allowIfClosest?: string[];
    /**
     * Additional predicate that can allow the event. Return true to allow (not block).
     */
    allowPredicate?: (event: Event, targetArea: HTMLElement) => boolean;
    /**
     * How to stop propagation when blocking the event. Default: "stopImmediate".
     */
    stopPropagation?: StopPropagationStrategy;
    /**
     * Whether to prevent default when blocking. Default: "always".
     */
    preventDefault?: PreventDefaultStrategy;
}

/**
 * Full configuration for building an EventGuard.
 */
export interface GuardConfig {
    query: TargetQuerySpec;
    behavior: GuardBehavior;
    style?: GuardStyleAdjustments;
    /**
     * Optional callback emitted when an event is blocked.
     */
    onBlocked?: (event: Event, targetArea: HTMLElement) => void;
    /** Optional callback emitted when an event is allowed through. */
    onAllowed?: (event: Event, targetArea: HTMLElement) => void;
    /** Enable debug logging for this guard. */
    debugName?: string;
}

type ListenerBinding = {
    element: HTMLElement;
    type: GuardEventName;
    options: AddEventListenerOptions | boolean;
    listener: EventListener;
};

/**
 * A reusable, strongly typed event guard utility for intercepting and controlling DOM events.
 */
export class EventGuard {
    private config: GuardConfig;
    private listeners: ListenerBinding[] = [];
    private styled: HTMLElement[] = [];
    private enabled = false;
    private logger?: Logger;

    constructor(config: GuardConfig) {
        this.config = EventGuard.withDefaults(config);
        if (this.config.debugName) {
            this.logger = new Logger(`Guard:${this.config.debugName}`, "#94a3b8");
        }
    }

    static withDefaults(config: GuardConfig): GuardConfig {
        return {
            ...config,
            behavior: {
                events: config.behavior.events ?? EventGroups.pointer,
                capture: config.behavior.capture ?? true,
                passive: config.behavior.passive ?? false,
                once: config.behavior.once ?? false,
                allowIfClosest: config.behavior.allowIfClosest ?? [],
                allowPredicate: config.behavior.allowPredicate,
                stopPropagation: config.behavior.stopPropagation ?? "stopImmediate",
                preventDefault: config.behavior.preventDefault ?? "always",
            },
        } as GuardConfig;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public enable(): void {
        if (this.enabled) {
            return;
        }
        this.enabled = true;
        this.bindAll();
    }

    public disable(): void {
        if (!this.enabled) {
            return;
        }
        this.unbindAll();
        this.enabled = false;
    }

    public update(next: Partial<GuardConfig>): void {
        this.config = EventGuard.withDefaults({ ...this.config, ...next, behavior: { ...this.config.behavior, ...(next.behavior ?? {}) }, query: { ...this.config.query, ...(next.query ?? {}) }, style: { ...this.config.style, ...(next.style ?? {}) } });
        if (this.enabled) {
            this.unbindAll();
            this.bindAll();
        }
    }

    private log(...args: unknown[]): void {
        this.logger?.info(...(args as []));
    }

    private resolveRoots(): ParentNode[] {
        const { roots = [document], scope } = this.config.query;
        const resolvedRoots: ParentNode[] = [];
        for (const r of roots) {
            const base = typeof r === "string" || typeof (r as unknown) === "object" ? selectOne(r as AnySelector) ?? document : (r as ParentNode);
            if (scope) {
                const scoped = selectOne(scope, base) as ParentNode | null;
                if (scoped) {
                    resolvedRoots.push(scoped);
                    continue;
                }
            }
            resolvedRoots.push(base);
        }
        return resolvedRoots;
    }

    private resolveTargets(): HTMLElement[] {
        const { selectors, filter } = this.config.query;
        const roots = this.resolveRoots();
        const out = new Set<HTMLElement>();
        for (const root of roots) {
            for (const sel of selectors) {
                const list = Array.from(root.querySelectorAll<HTMLElement>(sel));
                for (const el of list) {
                    if (filter && !filter(el)) {
                        continue;
                    }
                    out.add(el);
                }
            }
        }
        return Array.from(out);
    }

    private bindAll(): void {
        const targets = this.resolveTargets();
        const { style, behavior } = this.config;
        for (const el of targets) {
            if (style) {
                try {
                    if (style.cursor) {
                        el.style.cursor = style.cursor;
                    }
                    if (style.addClass) {
                        el.classList.add(style.addClass);
                    }
                    if (style.attributes) {
                        for (const [k, v] of Object.entries(style.attributes)) {
                            el.setAttribute(k, v);
                        }
                    }
                    this.styled.push(el);
                } catch {
                    // ignore styling errors
                }
            }
            for (const type of behavior.events) {
                const listener = (e: Event) => this.handle(e, el);
                const options: AddEventListenerOptions | boolean = behavior.capture ?? false
                    ? { capture: true, passive: behavior.passive, once: behavior.once }
                    : { capture: false, passive: behavior.passive, once: behavior.once };
                el.addEventListener(type, listener, options);
                this.listeners.push({ element: el, type, options, listener });
            }
        }
        this.log("enabled for", targets.length, "targets");
    }

    private unbindAll(): void {
        for (const { element, type, listener, options } of this.listeners) {
            element.removeEventListener(type, listener, options);
        }
        this.listeners = [];
        for (const el of this.styled) {
            try {
                el.style.removeProperty("cursor");
            } catch {
                // ignore
            }
        }
        this.styled = [];
        this.log("disabled");
    }

    private shouldAllow(event: Event, area: HTMLElement): boolean {
        const { allowIfClosest = [], allowPredicate } = this.config.behavior;
        const t = event.target as HTMLElement | null;
        if (!t) {
            return true;
        }
        for (const sel of allowIfClosest) {
            if (t.closest(sel)) {
                return true;
            }
        }
        if (allowPredicate && allowPredicate(event, area)) {
            return true;
        }
        return false;
    }

    private handle(event: Event, area: HTMLElement): void {
        if (this.shouldAllow(event, area)) {
            this.config.onAllowed?.(event, area);
            return;
        }
        const { stopPropagation = "stopImmediate", preventDefault = "always" } = this.config.behavior;
        if (stopPropagation === "stopImmediate" && typeof (event as unknown as { stopImmediatePropagation?: () => void; }).stopImmediatePropagation === "function") {
            (event as unknown as { stopImmediatePropagation?: () => void; }).stopImmediatePropagation?.();
        } else if (stopPropagation === "stop") {
            event.stopPropagation();
        }
        if (preventDefault === "always" || (preventDefault === "auto" && (event.cancelable ?? false))) {
            event.preventDefault();
        }
        this.config.onBlocked?.(event, area);
    }
}

export function createEventGuard(config: GuardConfig): EventGuard {
    return new EventGuard(config);
}

