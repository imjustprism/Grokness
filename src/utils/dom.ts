/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// --- Types ---

/**
 * Configuration for selecting DOM elements.
 */
export interface ElementSelectorConfig {
    /** CSS selector string. */
    selector: string;
    /** Optional root element to scope the query (defaults to document). */
    root?: Document | Element;
    /** If true, throws an error if the element is not found. */
    required?: boolean;
}

/**
 * Configuration for mutation observers.
 */
export interface MutationObserverConfig {
    /** The target element to observe. */
    target: Element;
    /** MutationObserver initialization options. */
    options: MutationObserverInit;
    /** Callback function for observed mutations. */
    callback: (mutations: MutationRecord[], observer: MutationObserver) => void;
    /** Optional debounce delay in milliseconds. */
    debounceDelay?: number;
    /** Use requestAnimationFrame for debouncing. */
    useRaf?: boolean;
}

/**
 * Configuration for hiding elements.
 */
export interface ElementHideConfig {
    /** CSS selector to target elements. */
    selector: string;
    /** Description for logging purposes. */
    description: string;
    /** Optional condition to check before hiding (supports regex if needed). */
    condition?: (element: HTMLElement) => boolean;
    /** If true, removes the element from the DOM instead of hiding it. */
    removeFromDom?: boolean;
    /** Custom attribute to mark hidden elements (defaults to 'data-hidden'). */
    markerAttribute?: string;
    /** Optional regex pattern for matching textContent or attributes. */
    regexPattern?: RegExp;
    /** Attribute to apply regex to (e.g., 'textContent', 'class'). */
    regexTarget?: "textContent" | "class" | "id" | string;
}

/**
 * Options for element hider observer.
 */
export interface ElementHiderOptions {
    /** Debounce delay in milliseconds. */
    debounce?: number;
    /** Use requestAnimationFrame for debouncing instead of setTimeout. */
    useRequestAnimationFrame?: boolean;
    /** Automatically inject CSS to hide elements preemptively. */
    injectCss?: boolean;
}

// --- Selection Utilities ---

/**
 * Selects the first element matching the selector.
 * @returns The matching HTMLElement or null if not found.
 */
export function querySelector(
    selector: string,
    root: Document | Element = document
): HTMLElement | null {
    if (!root) {
        throw new Error("Root element is null or undefined");
    }
    if (!selector.trim()) {
        console.warn("Invalid or empty selector provided");
        return null;
    }
    try {
        return root.querySelector(selector) as HTMLElement | null;
    } catch (error) {
        console.warn(`Invalid selector: ${selector}`, error);
        return null;
    }
}

/**
 * Selects the first element matching the selector, throwing if not found.
 * @returns The matching HTMLElement.
 */
export function querySelectorRequired(
    selector: string,
    root: Document | Element = document
): HTMLElement {
    const element = querySelector(selector, root);
    if (!element) {
        throw new Error(`Required element not found: ${selector}`);
    }
    return element;
}

/**
 * Selects all elements matching the selector.
 * @returns An array of matching HTMLElements.
 */
export function querySelectorAll(
    selector: string,
    root: Document | Element = document
): HTMLElement[] {
    if (!root) {
        throw new Error("Root element is null or undefined");
    }
    if (!selector.trim()) {
        console.warn("Invalid or empty selector provided");
        return [];
    }
    try {
        return Array.from(root.querySelectorAll(selector)) as HTMLElement[];
    } catch (error) {
        console.warn(`Invalid selector: ${selector}`, error);
        return [];
    }
}

// --- Injection Utilities ---

/**
 * Injects CSS styles into the document head.
 * @param cssContent The raw CSS string to inject.
 * @param styleId Optional ID for the style element (replaces existing if present).
 * @returns An object with the style element and a cleanup function.
 */
export function injectStyles(
    cssContent: string,
    styleId?: string
): { styleElement: HTMLStyleElement; cleanup: () => void; } {
    let styleElement = styleId ? document.getElementById(styleId) as HTMLStyleElement | null : null;

    if (styleElement) {
        styleElement.textContent = cssContent;
    } else {
        styleElement = document.createElement("style");
        if (styleId) {
            styleElement.id = styleId;
        }
        styleElement.textContent = cssContent;
        document.head.appendChild(styleElement);
    }

    const cleanup = () => {
        styleElement?.remove();
    };

    return { styleElement, cleanup };
}

/**
 * Injects a script into the page.
 * @param scriptContent The script code or source URL.
 * @param scriptId Optional ID for the script element.
 * @param options Additional script attributes (e.g., async, defer).
 * @returns The script element.
 */
export function injectScript(
    scriptContent: string | { src: string; },
    scriptId?: string,
    options: { async?: boolean; defer?: boolean; } = {}
): HTMLScriptElement {
    const scriptElement = document.createElement("script");
    if (scriptId) {
        scriptElement.id = scriptId;
    }
    if (typeof scriptContent === "string") {
        scriptElement.textContent = scriptContent;
    } else {
        scriptElement.src = scriptContent.src;
    }
    scriptElement.async = options.async ?? false;
    scriptElement.defer = options.defer ?? false;
    (document.head || document.documentElement).appendChild(scriptElement);
    return scriptElement;
}

// --- Observer Management ---

/**
 * Manager for handling multiple MutationObservers.
 */
export class MutationObserverManager {
    private observersMap: Map<MutationObserver, string> = new Map();
    private nextObserverId = 0;

    /**
     * Creates a standard mutation observer.
     */
    public createObserver(config: MutationObserverConfig): { observe: () => void; disconnect: () => void; } {
        if (!config.target) {
            throw new Error("Target element is null or undefined");
        }

        const observerId = `observer-${this.nextObserverId++}`;
        const observer = new MutationObserver(config.callback);
        this.observersMap.set(observer, observerId);

        const observe = () => observer.observe(config.target, config.options);
        const disconnect = () => {
            observer.disconnect();
            this.observersMap.delete(observer);
        };

        return { observe, disconnect };
    }

    /**
     * Creates a debounced mutation observer.
     */
    public createDebouncedObserver(config: MutationObserverConfig): { observe: () => void; disconnect: () => void; } {
        let debounceTimer: ReturnType<typeof setTimeout> | number | null = null;

        const debouncedCallback = (mutations: MutationRecord[], observer: MutationObserver) => {
            const delay = config.debounceDelay ?? 100;
            if (debounceTimer !== null) {
                if (config.useRaf) {
                    cancelAnimationFrame(debounceTimer);
                } else {
                    clearTimeout(debounceTimer);
                }
            }
            const schedule = config.useRaf ? requestAnimationFrame : (cb: TimerHandler) => setTimeout(cb, delay);
            debounceTimer = schedule(() => config.callback(mutations, observer));
        };

        return this.createObserver({ ...config, callback: debouncedCallback });
    }

    /**
     * Disconnects all active observers.
     */
    public disconnectAll(): void {
        for (const observer of this.observersMap.keys()) {
            observer.disconnect();
        }
        this.observersMap.clear();
    }

    /**
     * Gets the count of active observers.
     */
    public getActiveCount(): number {
        return this.observersMap.size;
    }
}

// --- Visibility and Scrolling ---

/**
 * Checks if an element is visible in the viewport.
 */
export function isElementVisible(element: HTMLElement): boolean {
    if (!element) {
        return false;
    }
    const computedStyle = window.getComputedStyle(element);
    return (
        computedStyle.display !== "none" &&
        computedStyle.visibility !== "hidden" &&
        computedStyle.opacity !== "0" &&
        element.offsetParent !== null
    );
}

/**
 * Smoothly scrolls an element into view if it's not visible.
 */
export function scrollToElementIfNeeded(
    element: HTMLElement,
    scrollOptions: ScrollIntoViewOptions = { behavior: "smooth", block: "center" }
): void {
    const boundingRect = element.getBoundingClientRect();
    const isInViewport =
        boundingRect.top >= 0 &&
        boundingRect.left >= 0 &&
        boundingRect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        boundingRect.right <= (window.innerWidth || document.documentElement.clientWidth);

    if (!isInViewport) {
        element.scrollIntoView(scrollOptions);
    }
}

// --- Waiting and Events ---

/**
 * Waits for an element to appear in the DOM.
 * @returns A promise resolving to the element or rejecting on timeout.
 */
export async function waitForElementAppearance(
    selector: string,
    timeoutMs = 10000,
    root: Document | Element = document
): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
        let element = root.querySelector(selector) as HTMLElement | null;
        if (element) {
            return resolve(element);
        }

        const mutationObserver = new MutationObserver(() => {
            element = root.querySelector(selector) as HTMLElement | null;
            if (element) {
                mutationObserver.disconnect();
                resolve(element);
            }
        });

        mutationObserver.observe(root, { childList: true, subtree: true });

        setTimeout(() => {
            mutationObserver.disconnect();
            reject(new Error(`Element "${selector}" not found within ${timeoutMs}ms`));
        }, timeoutMs);
    });
}

/**
 * Adds a delegated event listener to a root element.
 * @param options Optional event listener options.
 */
export function addDelegatedListener(
    root: HTMLElement | Document,
    selector: string,
    eventType: string,
    handler: (event: Event, matchedElement: HTMLElement) => void,
    options?: AddEventListenerOptions
): () => void {
    const listener = (event: Event) => {
        const targetElement = (event.target as HTMLElement)?.closest(selector);
        if (targetElement && root.contains(targetElement)) {
            handler(event, targetElement as HTMLElement);
        }
    };
    root.addEventListener(eventType, listener, options);
    return () => root.removeEventListener(eventType, listener);
}

/**
 * Adds a one-time event listener that auto-removes after firing.
 */
export function addOneTimeListener(
    element: Element,
    eventType: string,
    handler: EventListenerOrEventListenerObject
): () => void {
    const wrappedHandler = (event: Event) => {
        element.removeEventListener(eventType, wrappedHandler as EventListener);
        if (typeof handler === "function") {
            handler(event);
        } else {
            handler.handleEvent(event);
        }
    };
    element.addEventListener(eventType, wrappedHandler as EventListener);
    return () => element.removeEventListener(eventType, wrappedHandler as EventListener);
}

// --- Clipboard and Accessibility ---

/**
 * Copies text to the clipboard.
 * @throws Error if clipboard access fails.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
    try {
        await navigator.clipboard?.writeText(text) ?? Promise.reject(new Error("Clipboard not supported"));
    } catch {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand("copy");
        } catch (err) {
            console.error("Fallback copy failed:", err);
            throw err;
        } finally {
            document.body.removeChild(textArea);
        }
    }
}

/**
 * Traps focus within a container element (e.g., for modals).
 * @returns A cleanup function to remove the trap.
 */
export function createFocusTrap(container: HTMLElement): () => void {
    const focusableSelector =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusableElements = () => Array.from(container.querySelectorAll(focusableSelector)) as HTMLElement[];

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Tab") {
            return;
        }
        const elements = getFocusableElements();
        if (elements.length === 0) {
            return;
        }

        const first = elements[0];
        const last = elements[elements.length - 1];

        if (event.shiftKey) {
            if (document.activeElement === first) {
                last!.focus();
                event.preventDefault();
            }
        } else {
            if (document.activeElement === last) {
                first!.focus();
                event.preventDefault();
            }
        }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
}

/**
 * Announces a message to screen readers via an ARIA live region.
 */
export function announceToScreenReader(
    message: string,
    politenessLevel: "polite" | "assertive" = "polite"
): void {
    let liveRegion = document.getElementById("__extension-aria-live-region");
    if (!liveRegion) {
        liveRegion = document.createElement("div");
        liveRegion.id = "__extension-aria-live-region";
        liveRegion.setAttribute("aria-live", politenessLevel);
        liveRegion.setAttribute("role", "status");
        Object.assign(liveRegion.style, {
            position: "absolute",
            width: "1px",
            height: "1px",
            overflow: "hidden",
            clip: "rect(1px, 1px, 1px, 1px)",
        });
        document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = "";
    requestAnimationFrame(() => liveRegion!.textContent = message);
}

// --- Styles and Themes ---

/**
 * Retrieves a computed style value, resolving CSS variables recursively.
 */
export function getResolvedComputedStyle(
    element: HTMLElement,
    propertyName: string
): string {
    let styleValue = getComputedStyle(element).getPropertyValue(propertyName).trim();

    // Recursively resolve CSS variables
    const varRegex = /var\((--[^)]+)\)/;
    while (varRegex.test(styleValue)) {
        const variableName = styleValue.match(varRegex)?.[1];
        if (!variableName) {
            break;
        }
        styleValue = getComputedStyle(element).getPropertyValue(variableName).trim();
    }

    return styleValue;
}

/**
 * Toggles dark mode on the document root.
 * @param force Optional boolean to force enable/disable.
 */
export function toggleDarkTheme(force?: boolean): void {
    const rootElement = document.documentElement;

    if (force === undefined) {
        rootElement.classList.toggle("dark");
    } else {
        rootElement.classList.toggle("dark", force);
    }

    // Optional: Sync with system preference if needed
    // if (matchMedia("(prefers-color-scheme: dark)").matches) { ... }
}

// --- Element Manipulation ---

/**
 * Creates an HTMLElement from an HTML string.
 */
export function createElementFromHtml(htmlString: string): HTMLElement {
    const templateElement = document.createElement("template");
    templateElement.innerHTML = htmlString.trim();
    const childElement = templateElement.content.firstElementChild;
    if (!childElement || !(childElement instanceof HTMLElement)) {
        throw new Error("Invalid HTML: Did not produce a valid HTMLElement");
    }
    return childElement;
}

/**
 * Removes an element from the DOM if it exists.
 */
export function removeDomElement(element: Element | null): void {
    element?.remove();
}

/**
 * Replaces one DOM node with another.
 */
export function replaceDomNode(oldNode: Node | null, newNode: Node): void {
    oldNode?.parentNode?.replaceChild(newNode, oldNode);
}

// --- Hiding Utilities ---

/**
 * Hides or removes elements matching the configuration.
 * @returns The number of elements hidden or removed.
 */
export function hideDomElements(config: ElementHideConfig): number {
    let countHidden = 0;
    const markerAttr = config.markerAttribute || "data-hidden";

    try {
        const matchedElements = querySelectorAll(config.selector);

        for (const element of matchedElements) {
            let matchesCondition = true;
            if (config.condition) {
                matchesCondition = config.condition(element);
            } else if (config.regexPattern && config.regexTarget) {
                const targetValue = config.regexTarget === "textContent"
                    ? element.textContent ?? ""
                    : config.regexTarget === "class"
                        ? [...element.classList].join(" ")
                        : element.getAttribute(config.regexTarget) ?? "";
                matchesCondition = config.regexPattern.test(targetValue);
            }

            if (element.hasAttribute(markerAttr)) {
                continue;
            }

            if (matchesCondition) {
                element.setAttribute(markerAttr, "true");
                if (config.removeFromDom) {
                    removeDomElement(element);
                }
                countHidden++;
            } else {
                element.style.setProperty("display", "flex", "important");
                element.style.setProperty("visibility", "visible", "important");
            }
        }
    } catch (error) {
        console.warn(`Failed to hide elements for "${config.description}":`, error);
    }

    return countHidden;
}

/**
 * Creates an observer that automatically hides elements on DOM changes.
 */
export function createDomElementHider(
    targetElement: Element = document.body,
    hideConfigs: ElementHideConfig[],
    hiderOptions: ElementHiderOptions = {}
): { startObserving: () => void; stopObserving: () => void; hideImmediately: () => void; } {
    let debounceTimer: ReturnType<typeof setTimeout> | number | null = null;
    let isHiding = false;
    let styleManager: { cleanup: () => void; } | null = null;

    if (hiderOptions.injectCss) {
        const css = hideConfigs.map(config => `${config.selector} { display: none !important; visibility: hidden !important; }`).join("\n");
        styleManager = injectStyles(css, "element-hider-preemptive");
    }

    const performHide = () => {
        if (isHiding) {
            return;
        }
        isHiding = true;
        requestAnimationFrame(() => {
            for (const config of hideConfigs) {
                hideDomElements(config);
            }
            isHiding = false;
        });
    };

    const debouncedPerformHide = () => {
        if (debounceTimer !== null) {
            if (hiderOptions.useRequestAnimationFrame) {
                cancelAnimationFrame(debounceTimer);
            } else {
                clearTimeout(debounceTimer);
            }
        }
        const delay = hiderOptions.debounce ?? 0;
        const schedule = hiderOptions.useRequestAnimationFrame ? requestAnimationFrame : (cb: TimerHandler) => setTimeout(cb, delay);
        debounceTimer = schedule(performHide);
    };

    const mutationObserver = new MutationObserver(mutations => {
        let hasChanges = false;
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    continue;
                }
                const element = node as HTMLElement;
                if (hideConfigs.some(config => {
                    if (element.matches(config.selector)) {
                        return true;
                    }
                    return !!element.querySelector(config.selector);
                })) {
                    hasChanges = true;
                    break;
                }
            }
            if (hasChanges) {
                break;
            }
        }
        if (hasChanges) {
            debouncedPerformHide();
        }
    });

    return {
        startObserving: () => mutationObserver.observe(targetElement, { childList: true, subtree: true }),
        stopObserving: () => {
            mutationObserver.disconnect();
            if (debounceTimer !== null) {
                if (hiderOptions.useRequestAnimationFrame) {
                    cancelAnimationFrame(debounceTimer);
                } else {
                    clearTimeout(debounceTimer);
                }
            }
            styleManager?.cleanup();
        },
        hideImmediately: performHide,
    };
}
