/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokAPI } from "@api/api";
import type { RateLimitData } from "@api/interfaces";
import { IconButton } from "@components/IconButton";
import { Devs } from "@utils/constants";
import {
    type ElementFinderConfig,
    findElement,
    MutationObserverManager,
    querySelector,
    waitForElementByConfig,
} from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePluginSettings } from "@utils/settings";
import { definePlugin, type IPatch } from "@utils/types";
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

const logger = new Logger("RateLimitDisplay", "#a6d189");

const settings = definePluginSettings({
    autoRefresh: {
        type: "boolean",
        displayName: "Auto Refresh",
        description: "Automatically refresh rate limit display periodically.",
        default: true,
    },
    refreshInterval: {
        type: "number",
        displayName: "Refresh Interval (seconds)",
        description: "Time between automatic refreshes (minimum 30 seconds).",
        default: 60,
        min: 30,
    },
    displayFormat: {
        type: "select",
        displayName: "Display Format",
        description: "How to display the rate limit information.",
        options: [
            { label: "Remaining Only", value: "remaining" },
            { label: "Percentage", value: "percentage" },
        ],
        default: "remaining",
    },
});

const MODEL_MAP: Record<string, string> = {
    "Grok 4": "grok-4",
    "Grok 3": "grok-3",
    "Grok 4 Heavy": "grok-4-heavy",
    "Grok 4 With Effort Decider": "grok-4-auto",
    "Expert": "grok-4",
    "Fast": "grok-3",
    "Auto": "grok-4-auto",
    "Heavy": "grok-4-heavy",
} satisfies Record<string, string>;

const DEFAULT_MODEL = "grok-4";
const DEFAULT_KIND = "DEFAULT";
const DEBOUNCE_DELAY_MS = 100;
const BODY_OBSERVER_DEBOUNCE_MS = 200;
const ELEMENT_WAIT_TIMEOUT_MS = 5000;
const API_RETRY_MAX = 3;
const API_RETRY_BACKOFF_INITIAL_MS = 1000;
const API_RETRY_BACKOFF_MULTIPLIER = 2;
const SUBMIT_RESPONSE_DEBOUNCE_MS = 500;
const SUBMIT_MAX_TIMEOUT_MS = 30000;

const RATE_LIMIT_CONTAINER_ID = "grok-rate-limit-container";

const commonSelectors = {
    queryBar: ".query-bar",
    modelButton: ".query-bar button:has(span.inline-block.text-primary)",
    modelSpan: ".query-bar button span.inline-block.text-primary",
    textarea: ".query-bar textarea",
    attachButton: '.query-bar button.group\\/attach-button, .query-bar button svg path[d*="M10 9V15"]',
} as const;

const commonFinderConfigs = {
    thinkButton: {
        selector: `${commonSelectors.queryBar} button`,
        ariaLabel: "Think",
        svgPartialD: "M19 9C19 12.866",
    } satisfies ElementFinderConfig,
    deepSearchButton: {
        selector: `${commonSelectors.queryBar} button`,
        ariaLabelRegex: /Deep(er)?Search/i,
    } satisfies ElementFinderConfig,
    attachButton: {
        selector: `${commonSelectors.queryBar} button`,
        classContains: ["group/attach-button"],
        svgPartialD: "M10 9V15",
    } satisfies ElementFinderConfig,
    modelSelectorButton: {
        selector: commonSelectors.modelButton,
        attrRegex: { attr: "aria-haspopup", regex: /menu/ },
    } satisfies ElementFinderConfig,
} as const;

const cachedRateLimits: Record<string, Record<string, RateLimitData | undefined>> = {};
const observerManager = new MutationObserverManager();

type EffortLevel = "high" | "low" | "both";

type ProcessedRateLimit = { error: true; } | {
    isBoth: boolean;
    highRemaining: number;
    highTotal: number;
    lowRemaining?: number;
    lowTotal?: number;
    waitTimeSeconds: number;
};

async function fetchWithRetry<T>(
    fetchFn: () => Promise<T>,
    maxRetries: number = API_RETRY_MAX,
    backoffMs: number = API_RETRY_BACKOFF_INITIAL_MS
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fetchFn();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries - 1) {
                const delay = backoffMs * Math.pow(API_RETRY_BACKOFF_MULTIPLIER, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError ?? new Error("Unknown error during fetch");
}

function normalizeModelName(rawName: string): string {
    const trimmed = rawName.trim();
    return trimmed ? (MODEL_MAP[trimmed] ?? trimmed.toLowerCase().replace(/\s+/g, "-")) : DEFAULT_MODEL;
}

function getEffortLevel(modelName: string): EffortLevel {
    if (modelName === "grok-4-auto") {
        return "both";
    } else if (modelName === "grok-3") {
        return "low";
    } else {
        return "high";
    }
}

async function fetchRateLimit(modelName: string, requestKind: string, force: boolean = false): Promise<RateLimitData | null> {
    if (!force && cachedRateLimits[modelName]?.[requestKind] !== undefined) {
        return cachedRateLimits[modelName][requestKind] ?? null;
    }

    try {
        const data = await fetchWithRetry(() => grokAPI.rateLimits.get({ requestKind, modelName }));
        cachedRateLimits[modelName] ??= {};
        cachedRateLimits[modelName][requestKind] = data;
        return data;
    } catch (error) {
        logger.error(`Failed to fetch rate limit for ${modelName} (${requestKind}):`, error);
        cachedRateLimits[modelName] ??= {};
        cachedRateLimits[modelName][requestKind] = undefined;
        return null;
    }
}

function processRateLimitData(data: RateLimitData | null, effortLevel: EffortLevel): ProcessedRateLimit {
    if (!data) {
        return { error: true };
    }

    const processed: ProcessedRateLimit = {
        isBoth: effortLevel === "both",
        highRemaining: 0,
        highTotal: 0,
        waitTimeSeconds: data.waitTimeSeconds ?? 0
    };

    if (effortLevel === "both") {
        processed.highRemaining = data.highEffortRateLimits?.remainingQueries ?? 0;
        processed.highTotal = data.highEffortRateLimits?.totalQueries ?? data.totalQueries ?? 0;
        processed.lowRemaining = data.lowEffortRateLimits?.remainingQueries ?? 0;
        processed.lowTotal = data.lowEffortRateLimits?.totalQueries ?? data.totalQueries ?? 0;
    } else {
        const effLimits = effortLevel === "high" ? data.highEffortRateLimits : data.lowEffortRateLimits;
        processed.highRemaining = effLimits?.remainingQueries ?? data.remainingQueries ?? 0;
        processed.highTotal = effLimits?.totalQueries ?? data.totalQueries ?? 0;
    }

    return processed;
}

function useCurrentModel(): string {
    const [model, setModel] = useState<string>(DEFAULT_MODEL);

    useEffect(() => {
        const queryBar = querySelector(commonSelectors.queryBar);
        if (!queryBar) {
            logger.warn("Query bar not found for model detection");
            return () => { };
        }

        const updateModel = () => {
            const modelSpan = querySelector(commonSelectors.modelSpan, queryBar);
            const rawName = modelSpan?.textContent?.trim() ?? DEFAULT_MODEL;
            setModel(normalizeModelName(rawName));
        };

        const { observe, disconnect } = observerManager.createDebouncedObserver({
            target: queryBar,
            options: { childList: true, subtree: true, characterData: true, attributes: true },
            callback: updateModel,
            debounceDelay: DEBOUNCE_DELAY_MS,
        });

        updateModel();
        observe();

        return disconnect;
    }, []);

    return model;
}

function useCurrentRequestKind(currentModel: string): string {
    const [requestKind, setRequestKind] = useState<string>(DEFAULT_KIND);

    useEffect(() => {
        if (currentModel !== "grok-3") {
            setRequestKind(DEFAULT_KIND);
            return () => { };
        }

        const queryBar = querySelector(commonSelectors.queryBar);
        if (!queryBar) {
            logger.warn("Query bar not found for request kind detection");
            setRequestKind(DEFAULT_KIND);
            return () => { };
        }

        const updateKind = () => {
            const thinkButton = findElement({ ...commonFinderConfigs.thinkButton, root: queryBar });
            const searchButton = findElement({ ...commonFinderConfigs.deepSearchButton, root: queryBar });

            if (!thinkButton && !searchButton) {
                setRequestKind(DEFAULT_KIND);
                return;
            }

            if (thinkButton?.getAttribute("aria-pressed") === "true") {
                setRequestKind("REASONING");
            } else if (searchButton?.getAttribute("aria-pressed") === "true") {
                const searchAria = searchButton.getAttribute("aria-label") ?? "";
                setRequestKind(
                    /deeper/i.test(searchAria) ? "DEEPERSEARCH" :
                        /deep/i.test(searchAria) ? "DEEPSEARCH" :
                            DEFAULT_KIND
                );
            } else {
                setRequestKind(DEFAULT_KIND);
            }
        };

        const { observe, disconnect } = observerManager.createDebouncedObserver({
            target: queryBar,
            options: {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["aria-pressed", "class"],
                characterData: true,
            },
            callback: updateKind,
            debounceDelay: DEBOUNCE_DELAY_MS,
        });

        updateKind();
        observe();

        return disconnect;
    }, [currentModel]);

    return requestKind;
}

function RateLimitComponent() {
    const currentModel = useCurrentModel();
    const currentRequestKind = useCurrentRequestKind(currentModel);
    const effortLevel = getEffortLevel(currentModel);
    const [rateLimit, setRateLimit] = useState<ProcessedRateLimit | null>(null);
    const [lastRateLimit, setLastRateLimit] = useState<ProcessedRateLimit | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [waitTimeCountdown, setWaitTimeCountdown] = useState<number | null>(null);
    const [pendingRefresh, setPendingRefresh] = useState(false);

    const updateRateLimit = async (force: boolean = false) => {
        setIsLoading(true);
        try {
            const data = await fetchRateLimit(currentModel, currentRequestKind, force);
            const processed = processRateLimitData(data, effortLevel);
            if ("error" in processed) {
                setRateLimit(processed);
            } else {
                setRateLimit(processed);
                setLastRateLimit(processed);
                setWaitTimeCountdown(processed.waitTimeSeconds > 0 ? processed.waitTimeSeconds : null);
            }
        } catch (error) {
            logger.error("Error updating rate limit:", error);
            setRateLimit({ error: true });
        } finally {
            setIsLoading(false);
        }
    };

    const formatCountdown = (seconds: number): string => {
        if (seconds <= 0) {
            return "Resetting...";
        }
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return [
            hours > 0 ? `${hours}h` : "",
            minutes > 0 || hours > 0 ? `${minutes}m` : "",
            `${remainingSeconds}s`,
        ].filter(Boolean).join(" ");
    };

    useEffect(() => {
        if (waitTimeCountdown !== null && waitTimeCountdown > 0) {
            let lastUpdate = Date.now();
            const intervalId = setInterval(() => {
                const now = Date.now();
                const delta = Math.floor((now - lastUpdate) / 1000);
                lastUpdate = now;
                setWaitTimeCountdown(prev => {
                    if (prev === null) {
                        return null;
                    }
                    const newTime = Math.max(0, prev - delta);
                    if (newTime <= 0) {
                        updateRateLimit(true);
                        return null;
                    }
                    return newTime;
                });
            }, 1000);
            return () => clearInterval(intervalId);
        }
    }, [waitTimeCountdown]);

    useEffect(() => {
        updateRateLimit();
        let intervalId: number | null = null;
        if (settings.store.autoRefresh) {
            const intervalMs = Math.max(settings.store.refreshInterval * 1000, 30000);
            intervalId = setInterval(() => updateRateLimit(), intervalMs);
        }
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                updateRateLimit();
                if (settings.store.autoRefresh && !intervalId) {
                    const intervalMs = Math.max(settings.store.refreshInterval * 1000, 30000);
                    intervalId = setInterval(() => updateRateLimit(), intervalMs);
                }
            } else {
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [currentModel, currentRequestKind, settings.store.autoRefresh, settings.store.refreshInterval]);

    useEffect(() => {
        if (pendingRefresh) {
            const { observe, disconnect } = observerManager.createDebouncedObserver({
                target: document.body,
                options: { childList: true, subtree: true, characterData: true },
                callback: async () => {
                    await updateRateLimit(true);
                    setPendingRefresh(false);
                    disconnect();
                },
                debounceDelay: SUBMIT_RESPONSE_DEBOUNCE_MS,
            });
            observe();

            const timeoutId = setTimeout(() => {
                disconnect();
                updateRateLimit(true);
                setPendingRefresh(false);
            }, SUBMIT_MAX_TIMEOUT_MS);

            return () => {
                disconnect();
                clearTimeout(timeoutId);
            };
        }
    }, [pendingRefresh]);

    useEffect(() => {
        (async () => {
            try {
                const textarea = await waitForElementByConfig({ selector: commonSelectors.textarea }, ELEMENT_WAIT_TIMEOUT_MS);
                if (!textarea) {
                    return;
                }

                const handleKeyDown = (e: KeyboardEvent) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        setIsLoading(true);
                        setPendingRefresh(true);
                    }
                };

                textarea.addEventListener("keydown", handleKeyDown);
                return () => textarea.removeEventListener("keydown", handleKeyDown);
            } catch (error) {
                logger.error("Error setting up submit detection:", error);
            }
        })();
    }, []);

    const format = settings.store.displayFormat;

    const isError = rateLimit === null || ("error" in rateLimit && rateLimit.error);
    const currentData = isError ? lastRateLimit : rateLimit;

    let highRemaining = 0;
    let highTotal = 0;
    let lowRemaining = 0;
    let lowTotal = 0;
    let waitTime = 0;
    let isBoth = false;

    if (currentData && !("error" in currentData)) {
        highRemaining = currentData.highRemaining;
        highTotal = currentData.highTotal;
        lowRemaining = currentData.lowRemaining ?? 0;
        lowTotal = currentData.lowTotal ?? 0;
        waitTime = currentData.waitTimeSeconds;
        isBoth = currentData.isBoth;
    }

    const isLimited = isBoth
        ? highRemaining === 0 && lowRemaining === 0 && waitTime > 0
        : highRemaining === 0 && waitTime > 0;

    let content: string;

    if (isLimited) {
        content = formatCountdown(waitTimeCountdown ?? waitTime);
    } else if (currentData && !("error" in currentData)) {
        let highContent: string;
        let lowContent: string | undefined;

        if (format === "percentage") {
            highContent = highTotal > 0 ? `${Math.round((highRemaining / highTotal) * 100)}%` : highRemaining.toString();
            if (isBoth) {
                lowContent = lowTotal > 0 ? `${Math.round((lowRemaining / lowTotal) * 100)}%` : lowRemaining.toString();
            }
        } else {
            highContent = highRemaining.toString();
            if (isBoth) {
                lowContent = lowRemaining.toString();
            }
        }

        content = isBoth ? `${highContent} | ${lowContent}` : highContent;
    } else {
        content = "Unavailable";
    }

    let tooltipContent: string;

    if (isBoth) {
        tooltipContent = isLimited
            ? `Rate limit reached. Reset in ${formatCountdown(waitTimeCountdown ?? waitTime)}`
            : `High: ${highRemaining} queries left Low: ${lowRemaining} queries left`;
    } else {
        tooltipContent = isLimited
            ? `Rate limit reached. Reset in ${formatCountdown(waitTimeCountdown ?? waitTime)}`
            : `${highRemaining} queries left`;
    }

    return (
        <IconButton
            id="grok-rate-limit"
            as="button"
            variant="outline"
            size="md"
            icon={isLimited ? "Clock" : "Gauge"}
            loading={isLoading}
            onClick={() => updateRateLimit(true)}
            aria-label="Rate Limit"
            tooltipContent={tooltipContent}
            className={isLimited ? "text-fg-danger [&_svg]:text-fg-danger" : ""}
        >
            {content}
        </IconButton>
    );
}

const rateLimitPatch: IPatch = (() => {
    let rateLimitRoot: Root | null = null;
    let rateLimitContainer: HTMLDivElement | null = null;
    let queryBarObserverDisconnect: (() => void) | null = null;
    let bodyObserverDisconnect: (() => void) | null = null;

    function mountRateLimit() {
        const queryBar = querySelector(commonSelectors.queryBar);
        if (!queryBar) {
            logger.warn("Query bar not found for mounting rate limit");
            return;
        }

        const attachButton = findElement({ ...commonFinderConfigs.attachButton, root: queryBar });
        if (!attachButton) {
            logger.warn("Attach button not found in query bar");
            return;
        }

        const existingContainer = document.getElementById(RATE_LIMIT_CONTAINER_ID);
        if (existingContainer) {
            if (attachButton.parentElement?.contains(existingContainer)) {
                return;
            }
            existingContainer.remove();
        }

        rateLimitContainer = document.createElement("div");
        rateLimitContainer.id = RATE_LIMIT_CONTAINER_ID;
        attachButton.insertAdjacentElement("afterend", rateLimitContainer);
        rateLimitRoot = createRoot(rateLimitContainer);
        rateLimitRoot.render(<RateLimitComponent />);
    }

    function unmountRateLimit() {
        rateLimitRoot?.unmount();
        rateLimitContainer?.remove();
        rateLimitRoot = null;
        rateLimitContainer = null;
    }

    return {
        apply() {
            const mutationCallback = () => {
                const queryBar = querySelector(commonSelectors.queryBar);
                if (queryBar) {
                    mountRateLimit();
                    queryBarObserverDisconnect?.();
                    const { observe, disconnect } = observerManager.createDebouncedObserver({
                        target: queryBar,
                        options: { childList: true, subtree: true, attributes: true },
                        callback: mountRateLimit,
                        debounceDelay: DEBOUNCE_DELAY_MS,
                    });
                    observe();
                    queryBarObserverDisconnect = disconnect;
                }
            };

            const { observe: bodyObserve, disconnect: bodyDisconnect } = observerManager.createDebouncedObserver({
                target: document.body,
                options: { childList: true, subtree: true, attributes: true },
                callback: mutationCallback,
                debounceDelay: BODY_OBSERVER_DEBOUNCE_MS,
            });

            bodyObserve();
            bodyObserverDisconnect = bodyDisconnect;

            mutationCallback();

            document.addEventListener("visibilitychange", mutationCallback);
        },
        remove() {
            queryBarObserverDisconnect?.();
            bodyObserverDisconnect?.();
            unmountRateLimit();
            document.removeEventListener("visibilitychange", () => { });
            observerManager.disconnectAll();
        },
    };
})();

export default definePlugin({
    name: "Rate Limit Display",
    description: "Displays the remaining queries for the current model in the chat bar.",
    authors: [Devs.blankspeaker, Devs.CursedAtom, Devs.Prism],
    category: "chat",
    tags: ["rate-limit", "queries"],
    settings,
    patches: [rateLimitPatch],
});
