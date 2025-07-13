/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface ElementSelectorConfig {
    selector: string;
    root?: Document | Element;
    required?: boolean;
}

export interface MutationObserverConfig {
    target: Element;
    options: MutationObserverInit;
    callback: (mutations: MutationRecord[], observer: MutationObserver) => void;
    debounceDelay?: number;
    useRaf?: boolean;
}

export interface ElementHideConfig {
    selector: string;
    description: string;
    condition?: (element: HTMLElement) => boolean;
    removeFromDom?: boolean;
    markerAttribute?: string;
    regexPattern?: RegExp;
    regexTarget?: "textContent" | "class" | "id" | string;
}

export interface ElementHiderOptions {
    debounce?: number;
    useRequestAnimationFrame?: boolean;
    injectCss?: boolean;
}

export interface ElementFinderConfig {
    selector: string;
    root?: Document | Element;
    filter?: (el: HTMLElement) => boolean;
    textRegex?: RegExp;
    attrRegex?: { attr: string; regex: RegExp; };
    svgPartialD?: string;
    ariaLabel?: string;
    ariaLabelRegex?: RegExp;
    classContains?: string[];
    idContains?: string;
    matchDescendants?: boolean;
    xpath?: string;
}

export interface EventDelegationConfig {
    root: HTMLElement | Document;
    selector: string;
    eventType: string;
    handler: (event: Event, matchedElement: HTMLElement) => void;
    options?: AddEventListenerOptions;
}

export const commonSelectors = {
    queryBar: ".query-bar",
    modelButton: ".query-bar button:has(span.inline-block.text-primary)",
    modelSpan: ".query-bar button span.inline-block.text-primary",
    textarea: ".query-bar textarea",
    submitButton: '.query-bar button[type="submit"], .query-bar button svg path[d*="M5 11L12 4"]',
    attachButton: '.query-bar button.group\\/attach-button, .query-bar button svg path[d*="M10 9V15"]',
} as const;

export const commonFinderConfigs = {
    thinkButton: {
        selector: `${commonSelectors.queryBar} button`,
        ariaLabel: "Think",
        svgPartialD: "M19 9C19 12.866",
    } as ElementFinderConfig,
    deepSearchButton: {
        selector: `${commonSelectors.queryBar} button`,
        ariaLabelRegex: /Deep(er)?Search/i,
        svgPartialD: "M19.2987 8.84667",
    } as ElementFinderConfig,
    submitButton: {
        selector: `${commonSelectors.queryBar} button`,
        attrRegex: { attr: "type", regex: /submit/ },
        svgPartialD: "M5 11L12 4",
    } as ElementFinderConfig,
    attachButton: {
        selector: `${commonSelectors.queryBar} button`,
        classContains: ["group/attach-button"],
        svgPartialD: "M10 9V15",
    } as ElementFinderConfig,
    modelSelectorButton: {
        selector: commonSelectors.modelButton,
        attrRegex: { attr: "aria-haspopup", regex: /menu/ },
    } as ElementFinderConfig,
} as const;

/**
 * Selects the first element matching the selector.
 * @param selector CSS selector string.
 * @param root Optional root element (defaults to document).
 * @returns Matching HTMLElement or null.
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
 * @param selector CSS selector string.
 * @param root Optional root element (defaults to document).
 * @returns Matching HTMLElement.
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
 * @param selector CSS selector string.
 * @param root Optional root element (defaults to document).
 * @returns Array of matching HTMLElements.
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

/**
 * Finds an element using advanced multi-criteria configuration.
 * @param config Finder configuration.
 * @returns First matching HTMLElement or null.
 */
export function findElement(config: ElementFinderConfig): HTMLElement | null {
    const root = config.root ?? document;
    let candidates: HTMLElement[] = [];
    if (config.xpath) {
        const result = document.evaluate(config.xpath, root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (let i = 0; i < result.snapshotLength; i++) {
            const node = result.snapshotItem(i);
            if (node instanceof HTMLElement) {
                candidates.push(node);
            }
        }
    } else {
        candidates = querySelectorAll(config.selector, root);
    }

    for (const el of candidates) {
        let match = true;

        if (config.filter && !config.filter(el)) {
            match = false;
        }

        if (match && config.textRegex) {
            const text = (config.matchDescendants ? el.innerText : el.textContent)?.trim() ?? "";
            if (!config.textRegex.test(text)) {
                match = false;
            }
        }

        if (match && config.attrRegex) {
            const attrValue = el.getAttribute(config.attrRegex.attr) ?? "";
            if (!config.attrRegex.regex.test(attrValue)) {
                match = false;
            }
        }

        if (match && config.svgPartialD) {
            const paths = (config.matchDescendants ? el : el).querySelectorAll("svg path");
            let hasMatch = false;
            for (const path of paths) {
                const d = path.getAttribute("d") ?? "";
                if (d.includes(config.svgPartialD)) {
                    hasMatch = true;
                    break;
                }
            }
            if (!hasMatch) {
                match = false;
            }
        }

        if (match && config.ariaLabel) {
            const aria = el.getAttribute("aria-label") ?? "";
            if (aria !== config.ariaLabel) {
                match = false;
            }
        }

        if (match && config.ariaLabelRegex) {
            const aria = el.getAttribute("aria-label") ?? "";
            if (!config.ariaLabelRegex.test(aria)) {
                match = false;
            }
        }

        if (match && config.classContains) {
            const classes = el.classList;
            if (!config.classContains.every(cls => classes.contains(cls))) {
                match = false;
            }
        }

        if (match && config.idContains) {
            const id = el.id ?? "";
            if (!id.includes(config.idContains)) {
                match = false;
            }
        }

        if (match) {
            return el;
        }
    }

    return null;
}

/**
 * Waits for an element matching the advanced config to appear in the DOM.
 * @param config Finder configuration.
 * @param timeoutMs Timeout in milliseconds (default: 10000).
 * @returns Promise resolving to the element or rejecting on timeout.
 */
export async function waitForElementByConfig(
    config: ElementFinderConfig,
    timeoutMs = 10000
): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
        let element = findElement(config);
        if (element) {
            return resolve(element);
        }

        const root = config.root ?? document;
        const observer = new MutationObserver(() => {
            element = findElement(config);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });

        observer.observe(root, { childList: true, subtree: true, attributes: true });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element not found within ${timeoutMs}ms using config: ${JSON.stringify(config)}`));
        }, timeoutMs);
    });
}

/**
 * Finds the closest ancestor matching the condition.
 * @param element Starting element.
 * @param condition Condition function.
 * @returns Matching ancestor or null.
 */
export function findAncestor(element: HTMLElement, condition: (el: HTMLElement) => boolean): HTMLElement | null {
    let current = element.parentElement;
    while (current) {
        if (condition(current)) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}

/**
 * Injects CSS styles into the document head.
 * @param cssContent Raw CSS string to inject.
 * @param styleId Optional ID for the style element.
 * @returns Object with style element and cleanup function.
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
 * @param scriptContent Script code or source URL.
 * @param scriptId Optional ID for the script element.
 * @param options Additional script attributes.
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

export class MutationObserverManager {
    private observersMap: Map<MutationObserver, string> = new Map();
    private nextObserverId = 0;

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

    public createDebouncedObserver(config: MutationObserverConfig): { observe: () => void; disconnect: () => void; } {
        let debounceTimer: ReturnType<typeof setTimeout> | number | null = null;

        const debouncedCallback = (mutations: MutationRecord[], observer: MutationObserver) => {
            const delay = config.debounceDelay ?? 100;
            if (debounceTimer !== null) {
                if (config.useRaf) {
                    cancelAnimationFrame(debounceTimer);
                } else {
                    clearTimeout(debounceTimer as ReturnType<typeof setTimeout>);
                }
            }
            const schedule = config.useRaf ? requestAnimationFrame : (cb: TimerHandler) => setTimeout(cb, delay);
            debounceTimer = schedule(() => config.callback(mutations, observer));
        };

        return this.createObserver({ ...config, callback: debouncedCallback });
    }

    public disconnectAll(): void {
        for (const observer of this.observersMap.keys()) {
            observer.disconnect();
        }
        this.observersMap.clear();
    }

    public getActiveCount(): number {
        return this.observersMap.size;
    }
}

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

export function addDelegatedListener(
    { root, selector, eventType, handler, options }: EventDelegationConfig
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

export function getResolvedComputedStyle(
    element: HTMLElement,
    propertyName: string
): string {
    let styleValue = getComputedStyle(element).getPropertyValue(propertyName).trim();

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

export function toggleDarkTheme(force?: boolean): void {
    const rootElement = document.documentElement;

    if (force === undefined) {
        rootElement.classList.toggle("dark");
    } else {
        rootElement.classList.toggle("dark", force);
    }
}

export function createElementFromHtml(htmlString: string): HTMLElement {
    const templateElement = document.createElement("template");
    templateElement.innerHTML = htmlString.trim();
    const childElement = templateElement.content.firstElementChild;
    if (!childElement || !(childElement instanceof HTMLElement)) {
        throw new Error("Invalid HTML: Did not produce a valid HTMLElement");
    }
    return childElement;
}

export function removeDomElement(element: Element | null): void {
    element?.remove();
}

export function replaceDomNode(oldNode: Node | null, newNode: Node): void {
    oldNode?.parentNode?.replaceChild(newNode, oldNode);
}

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
                clearTimeout(debounceTimer as ReturnType<typeof setTimeout>);
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
                if (hideConfigs.some(config => element.matches(config.selector) || !!element.querySelector(config.selector))) {
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
                    clearTimeout(debounceTimer as ReturnType<typeof setTimeout>);
                }
            }
            styleManager?.cleanup();
        },
        hideImmediately: performHide,
    };
}
