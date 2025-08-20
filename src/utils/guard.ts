/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type AnySelector, selectOne } from "@utils/dom";
import { Logger } from "@utils/logger";

const logger = new Logger("EventGuard", "#dc2626");

/**
 * Enhanced event names with better type safety and modern patterns.
 */
export type GuardEventName = keyof DocumentEventMap;

/**
 * Result type for guard operations.
 */
export type GuardResult<T = void> =
    | { readonly success: true; readonly data: T; }
    | { readonly success: false; readonly error: Error; };

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
    readonly element: HTMLElement;
    readonly type: GuardEventName;
    readonly options: AddEventListenerOptions | boolean;
    readonly listener: EventListener;
};

/**
 * Enhanced event guard with modern patterns and better error handling.
 */
export class EventGuard {
    private config: GuardConfig;
    private listeners: ListenerBinding[] = [];
    private styled: HTMLElement[] = [];
    private readonly logger: Logger;
    private enabled = false;
    private readonly stats = {
        eventsBlocked: 0,
        eventsAllowed: 0,
        lastEventTime: 0,
    };

    constructor(config: GuardConfig) {
        this.config = EventGuard.withDefaults(config);
        this.logger = this.config.debugName
            ? new Logger(`Guard:${this.config.debugName}`, "#94a3b8")
            : logger;
    }

    /**
     * Create a guard using a fluent builder pattern.
     */
    static builder(): EventGuardBuilder {
        return new EventGuardBuilder();
    }

    /**
     * Get guard statistics.
     */
    getStats() {
        return { ...this.stats };
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

    isEnabled(): boolean {
        return this.enabled;
    }

    enable(): GuardResult<void> {
        if (this.enabled) {
            return { success: true, data: undefined };
        }

        try {
            this.enabled = true;
            this.bindAll();
            this.logger.debug("Guard enabled");
            return { success: true, data: undefined };
        } catch (error) {
            this.enabled = false;
            const err = error as Error;
            this.logger.error("Failed to enable guard:", err);
            return { success: false, error: err };
        }
    }

    disable(): GuardResult<void> {
        if (!this.enabled) {
            return { success: true, data: undefined };
        }

        try {
            this.unbindAll();
            this.enabled = false;
            this.logger.debug("Guard disabled");
            return { success: true, data: undefined };
        } catch (error) {
            const err = error as Error;
            this.logger.error("Failed to disable guard:", err);
            return { success: false, error: err };
        }
    }

    update(next: Partial<GuardConfig>): GuardResult<void> {
        try {
            const wasEnabled = this.enabled;

            if (wasEnabled) {
                this.disable();
            }

            this.config = EventGuard.withDefaults({
                ...this.config,
                ...next,
                behavior: { ...this.config.behavior, ...(next.behavior ?? {}) },
                query: { ...this.config.query, ...(next.query ?? {}) },
                style: { ...this.config.style, ...(next.style ?? {}) }
            });

            if (wasEnabled) {
                this.enable();
            }

            this.logger.debug("Guard updated");
            return { success: true, data: undefined };
        } catch (error) {
            const err = error as Error;
            this.logger.error("Failed to update guard:", err);
            return { success: false, error: err };
        }
    }

    private resolveRoots(): ParentNode[] {
        const { roots = [document], scope } = this.config.query;
        const resolvedRoots: ParentNode[] = [];

        for (const r of roots) {
            try {
                let base: ParentNode;

                if (typeof r === "string") {
                    const result = selectOne(r);
                    base = result.success && result.data ? result.data : document;
                } else if (r instanceof Element || r instanceof Document || r instanceof DocumentFragment) {
                    base = r;
                } else {
                    this.logger.warn("Invalid root type:", r);
                    continue;
                }

                if (scope) {
                    const scopedResult = selectOne(scope, base);
                    const scoped = scopedResult.success ? scopedResult.data : null;
                    if (scoped) {
                        resolvedRoots.push(scoped);
                        continue;
                    }
                }

                resolvedRoots.push(base);
            } catch (error) {
                this.logger.error("Failed to resolve root:", r, error);
            }
        }

        return resolvedRoots;
    }

    private resolveTargets(): HTMLElement[] {
        const { selectors, filter } = this.config.query;
        const roots = this.resolveRoots();
        const out = new Set<HTMLElement>();

        for (const root of roots) {
            for (const sel of selectors) {
                try {
                    const list = Array.from(root.querySelectorAll<HTMLElement>(sel));
                    for (const el of list) {
                        if (filter && !filter(el)) {
                            continue;
                        }
                        out.add(el);
                    }
                } catch (error) {
                    this.logger.error(`Failed to query selector "${sel}":`, error);
                }
            }
        }

        return Array.from(out);
    }

    private bindAll(): void {
        const targets = this.resolveTargets();
        const { style, behavior } = this.config;

        for (const el of targets) {
            // Apply styling
            if (style) {
                this.applyStyling(el, style);
            }

            // Bind event listeners
            for (const type of behavior.events) {
                this.bindEventListener(el, type, behavior);
            }
        }

        this.logger.debug(`Enabled guard for ${targets.length} targets`);
    }

    private applyStyling(el: HTMLElement, style: GuardStyleAdjustments): void {
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
        } catch (error) {
            this.logger.warn("Failed to apply styling:", error);
        }
    }

    private bindEventListener(el: HTMLElement, type: GuardEventName, behavior: GuardBehavior): void {
        try {
            const listener = (e: Event) => this.handle(e, el);
            const options: AddEventListenerOptions | boolean = behavior.capture ?? false
                ? { capture: true, passive: behavior.passive, once: behavior.once }
                : { capture: false, passive: behavior.passive, once: behavior.once };

            el.addEventListener(type, listener, options);
            this.listeners.push({ element: el, type, options, listener });
        } catch (error) {
            this.logger.error(`Failed to bind ${type} listener:`, error);
        }
    }

    private unbindAll(): void {
        // Remove event listeners
        for (const { element, type, listener, options } of this.listeners) {
            try {
                element.removeEventListener(type, listener, options);
            } catch (error) {
                this.logger.warn(`Failed to remove ${type} listener:`, error);
            }
        }
        this.listeners = [];

        // Remove styling
        for (const el of this.styled) {
            try {
                el.style.removeProperty("cursor");
                if (this.config.style?.addClass) {
                    el.classList.remove(this.config.style.addClass);
                }
                if (this.config.style?.attributes) {
                    for (const k of Object.keys(this.config.style.attributes)) {
                        el.removeAttribute(k);
                    }
                }
            } catch (error) {
                this.logger.warn("Failed to remove styling:", error);
            }
        }
        this.styled = [];

        this.logger.debug("Guard disabled");
    }

    private shouldAllow(event: Event, area: HTMLElement): boolean {
        const { allowIfClosest = [], allowPredicate } = this.config.behavior;
        const t = event.target as HTMLElement | null;

        if (!t) {
            return true;
        }

        // Check if event target matches any allowed selectors
        for (const sel of allowIfClosest) {
            try {
                if (t.closest(sel)) {
                    return true;
                }
            } catch (error) {
                this.logger.warn(`Invalid selector "${sel}":`, error);
            }
        }

        // Check custom predicate
        if (allowPredicate) {
            try {
                if (allowPredicate(event, area)) {
                    return true;
                }
            } catch (error) {
                this.logger.error("Error in allowPredicate:", error);
            }
        }

        return false;
    }

    private handle(event: Event, area: HTMLElement): void {
        this.stats.lastEventTime = Date.now();

        if (this.shouldAllow(event, area)) {
            this.stats.eventsAllowed++;
            try {
                this.config.onAllowed?.(event, area);
            } catch (error) {
                this.logger.error("Error in onAllowed callback:", error);
            }
            return;
        }

        // Block the event
        this.stats.eventsBlocked++;
        const { stopPropagation = "stopImmediate", preventDefault = "always" } = this.config.behavior;

        try {
            // Stop propagation
            if (stopPropagation === "stopImmediate" && typeof (event as unknown as { stopImmediatePropagation?: () => void; }).stopImmediatePropagation === "function") {
                (event as unknown as { stopImmediatePropagation?: () => void; }).stopImmediatePropagation?.();
            } else if (stopPropagation === "stop") {
                event.stopPropagation();
            }

            // Prevent default
            if (preventDefault === "always" || (preventDefault === "auto" && (event.cancelable ?? false))) {
                event.preventDefault();
            }

            // Call blocked callback
            this.config.onBlocked?.(event, area);
        } catch (error) {
            this.logger.error("Error handling blocked event:", error);
        }
    }
}

/**
 * Fluent builder for creating EventGuards with better developer experience.
 */
export class EventGuardBuilder {
    private query: TargetQuerySpec = { selectors: [] };
    private behavior: Partial<GuardBehavior> = {};
    private style?: GuardStyleAdjustments;
    private onBlocked?: (event: Event, targetArea: HTMLElement) => void;
    private onAllowed?: (event: Event, targetArea: HTMLElement) => void;
    private debugName?: string;

    /**
     * Set the target selectors for the guard.
     */
    target(...selectors: string[]): this {
        this.query.selectors = selectors;
        return this;
    }

    /**
     * Set the root elements to search within.
     */
    roots(...roots: (ParentNode | AnySelector)[]): this {
        this.query.roots = roots;
        return this;
    }

    /**
     * Set a scope selector to narrow the search.
     */
    scope(selector: AnySelector): this {
        this.query.scope = selector;
        return this;
    }

    /**
     * Set a filter function for target elements.
     */
    filter(predicate: (el: HTMLElement) => boolean): this {
        this.query.filter = predicate;
        return this;
    }

    /**
     * Set the events to guard against.
     */
    events(...events: GuardEventName[]): this {
        this.behavior.events = events;
        return this;
    }

    /**
     * Use predefined event groups.
     */
    eventGroup(group: keyof typeof EventGroups): this {
        this.behavior.events = EventGroups[group];
        return this;
    }

    /**
     * Set capture mode for event listeners.
     */
    capture(capture = true): this {
        this.behavior.capture = capture;
        return this;
    }

    /**
     * Set passive mode for event listeners.
     */
    passive(passive = true): this {
        this.behavior.passive = passive;
        return this;
    }

    /**
     * Set one-time listener mode.
     */
    once(once = true): this {
        this.behavior.once = once;
        return this;
    }

    /**
     * Allow events if they match specific selectors.
     */
    allowIfClosest(...selectors: string[]): this {
        this.behavior.allowIfClosest = selectors;
        return this;
    }

    /**
     * Set custom allow predicate.
     */
    allowIf(predicate: (event: Event, targetArea: HTMLElement) => boolean): this {
        this.behavior.allowPredicate = predicate;
        return this;
    }

    /**
     * Set propagation strategy.
     */
    stopPropagation(strategy: StopPropagationStrategy): this {
        this.behavior.stopPropagation = strategy;
        return this;
    }

    /**
     * Set prevent default strategy.
     */
    preventDefault(strategy: PreventDefaultStrategy): this {
        this.behavior.preventDefault = strategy;
        return this;
    }

    /**
     * Set cursor style for guarded elements.
     */
    cursor(cursor: string): this {
        this.style = { ...this.style, cursor };
        return this;
    }

    /**
     * Add CSS class to guarded elements.
     */
    addClass(className: string): this {
        this.style = { ...this.style, addClass: className };
        return this;
    }

    /**
     * Set attributes on guarded elements.
     */
    attributes(attrs: Record<string, string>): this {
        this.style = { ...this.style, attributes: attrs };
        return this;
    }

    /**
     * Set callback for blocked events.
     */
    onEventBlocked(callback: (event: Event, targetArea: HTMLElement) => void): this {
        this.onBlocked = callback;
        return this;
    }

    /**
     * Set callback for allowed events.
     */
    onEventAllowed(callback: (event: Event, targetArea: HTMLElement) => void): this {
        this.onAllowed = callback;
        return this;
    }

    /**
     * Set debug name for logging.
     */
    debug(name: string): this {
        this.debugName = name;
        return this;
    }

    /**
     * Build the EventGuard instance.
     */
    build(): EventGuard {
        if (this.query.selectors.length === 0) {
            throw new Error("EventGuard must have at least one target selector");
        }
        if (!this.behavior.events || this.behavior.events.length === 0) {
            throw new Error("EventGuard must have at least one event type");
        }

        const config: GuardConfig = {
            query: this.query,
            behavior: this.behavior as GuardBehavior,
            style: this.style,
            onBlocked: this.onBlocked,
            onAllowed: this.onAllowed,
            debugName: this.debugName,
        };

        return new EventGuard(config);
    }

    /**
     * Build and enable the guard in one step.
     */
    buildAndEnable(): EventGuard {
        const guard = this.build();
        const result = guard.enable();
        if (!result.success) {
            throw result.error;
        }
        return guard;
    }
}

/**
 * Legacy wrapper for backward compatibility.
 * @deprecated Use EventGuard.builder() or new EventGuard() instead
 */
export function createEventGuard(config: GuardConfig): EventGuard {
    return new EventGuard(config);
}

