/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApiClient, createApiServices, type RateLimitData } from "@api/index";
import { Button } from "@components/Button";
import { Lucide } from "@components/Lucide";
import { Devs } from "@utils/constants";
import { findElement, MutationObserverManager, querySelector } from "@utils/dom";
import { Logger } from "@utils/logger";
import { ui } from "@utils/pluginDsl";
import { definePlugin, definePluginSettings } from "@utils/types";
import React, { useCallback, useEffect, useRef, useState } from "react";

const logger = new Logger("RateLimitDisplay", "#a6d189");

const CACHE_TTL_MS = 30_000;
type CacheEntry = { processed: ProcessedRateLimit; fetchedAt: number; };
const rateLimitCache = new Map<string, CacheEntry>();

function makeCacheKey(model: string, requestKind: string): string {
    return `${location.pathname}::${model}::${requestKind}`;
}

function getCached(model: string, requestKind: string): CacheEntry | null {
    const entry = rateLimitCache.get(makeCacheKey(model, requestKind));
    return entry ?? null;
}

function setCached(model: string, requestKind: string, processed: ProcessedRateLimit): void {
    rateLimitCache.set(makeCacheKey(model, requestKind), { processed, fetchedAt: Date.now() });
}

function cacheAgeMs(entry: CacheEntry): number {
    return Date.now() - entry.fetchedAt;
}

const settings = definePluginSettings({
    autoRefresh: {
        type: "boolean",
        displayName: "Auto Refresh",
        description: "Automatically refresh rate limit display every 60 seconds.",
        default: true
    }
});

const MODEL_MAP: Record<string, string> = {
    Auto: "grok-4-auto",
    Fast: "grok-3",
    Expert: "grok-4",
    Heavy: "grok-4-heavy",
    "Grok 3": "grok-3",
    "Grok 4": "grok-4",
    "Grok 4 Heavy": "grok-4-heavy"
};
const DEFAULT_MODEL = "grok-3";
const DEFAULT_KIND = "DEFAULT";
const QUERY_BAR_SELECTOR = ".query-bar";
const observerManager = new MutationObserverManager();

const api = ApiClient.fromWindow();
const apiServices = createApiServices(api);

type RateLimitPayload = {
    highEffortRateLimits?: { remainingQueries?: number; };
    lowEffortRateLimits?: { remainingQueries?: number; };
    waitTimeSeconds?: number;
    remainingQueries?: number;
};
type RateLimitResponse = RateLimitData & RateLimitPayload;

function getCurrentModelFromUI(): string {
    const queryBar = querySelector(QUERY_BAR_SELECTOR);
    if (!queryBar) {
        return DEFAULT_MODEL;
    }

    const modelButton = findElement({ selector: "button[aria-label='Model select']", root: queryBar });
    if (modelButton) {
        const modelNameSpan = querySelector("span.font-semibold", modelButton);
        const rawName = modelNameSpan?.textContent?.trim() ?? "";
        if (MODEL_MAP[rawName]) {
            return MODEL_MAP[rawName];
        }
    }

    const selectElement = querySelector("select[aria-hidden='true']", queryBar) as HTMLSelectElement | null;
    if (selectElement?.value) {
        const modelValue = selectElement.value;
        if (modelValue.startsWith("grok-")) {
            return modelValue;
        }
        const mapKey = Object.keys(MODEL_MAP).find(k => k.toLowerCase() === modelValue);
        if (mapKey) {
            return MODEL_MAP[mapKey]!;
        }
    }

    return DEFAULT_MODEL;
}

async function fetchRateLimit(modelName: string, requestKind: string): Promise<RateLimitResponse | null> {
    try {
        const data = (await apiServices.rateLimits.post({ requestKind, modelName })) as RateLimitResponse;
        return data;
    } catch (error) {
        logger.error(`Failed to fetch rate limit for ${modelName} (${requestKind}):`, error);
        return null;
    }
}

function useCurrentModel(): string {
    const [model, setModel] = useState<string>(getCurrentModelFromUI);
    useEffect(() => {
        const queryBar = querySelector(QUERY_BAR_SELECTOR);
        if (!queryBar) {
            return;
        }
        const updateModel = () => setModel(getCurrentModelFromUI());
        const { observe, disconnect } = observerManager.createDebouncedObserver({
            target: queryBar,
            options: { childList: true, subtree: true, characterData: true },
            callback: updateModel
        });
        updateModel();
        observe();
        return disconnect;
    }, []);
    return model;
}

function useCurrentRequestKind(currentModel: string): string {
    const getKind = useCallback((): string => {
        if (currentModel !== "grok-3") {
            return DEFAULT_KIND;
        }
        const queryBar = querySelector(QUERY_BAR_SELECTOR);
        if (!queryBar) {
            return DEFAULT_KIND;
        }
        const isPressed = (label: string) =>
            findElement({ selector: `button[aria-label="${label}"]`, root: queryBar })?.getAttribute("aria-pressed") === "true";
        if (isPressed("Think")) {
            return "REASONING";
        }
        if (isPressed("DeeperSearch") || isPressed("DeepSearch")) {
            return "DEEPSEARCH";
        }
        return DEFAULT_KIND;
    }, [currentModel]);

    const [requestKind, setRequestKind] = useState<string>(getKind);
    useEffect(() => {
        if (currentModel !== "grok-3") {
            setRequestKind(DEFAULT_KIND);
            return;
        }
        const queryBar = querySelector(QUERY_BAR_SELECTOR);
        if (!queryBar) {
            return;
        }
        const updateKind = () => setRequestKind(getKind());
        const { observe, disconnect } = observerManager.createDebouncedObserver({
            target: queryBar,
            options: { attributes: true, attributeFilter: ["aria-pressed"], subtree: true },
            callback: updateKind
        });
        updateKind();
        observe();
        return disconnect;
    }, [currentModel, getKind]);
    return requestKind;
}

type ProcessedRateLimit =
    | { error: true; }
    | {
        isBoth: boolean;
        highRemaining: number;
        lowRemaining?: number;
        waitTimeSeconds: number;
    };

function RateLimitDisplay() {
    const currentModel = useCurrentModel();
    const currentRequestKind = useCurrentRequestKind(currentModel);

    const modelRef = useRef(currentModel);
    const kindRef = useRef(currentRequestKind);

    const [rateLimit, setRateLimit] = useState<ProcessedRateLimit | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [countdown, setCountdown] = useState<number | null>(null);

    const fetchNow = useCallback(async (opts?: { background?: boolean; }) => {
        if (!opts?.background) {
            setIsLoading(true);
        }
        const model = modelRef.current;
        const kind = kindRef.current;
        const data = await fetchRateLimit(model, kind);
        if (!data) {
            setRateLimit({ error: true });
        } else {
            let processed: ProcessedRateLimit;
            if (model === "grok-4-auto") {
                processed = {
                    isBoth: true,
                    highRemaining: data.highEffortRateLimits?.remainingQueries ?? 0,
                    lowRemaining: data.lowEffortRateLimits?.remainingQueries ?? 0,
                    waitTimeSeconds: data.waitTimeSeconds ?? 0
                };
            } else {
                const limits = model === "grok-3" ? data.lowEffortRateLimits : data.highEffortRateLimits;
                processed = {
                    isBoth: false,
                    highRemaining: limits?.remainingQueries ?? data.remainingQueries ?? 0,
                    waitTimeSeconds: data.waitTimeSeconds ?? 0
                };
            }
            setRateLimit(processed);
            setCached(model, kind, processed);
            if (processed.waitTimeSeconds > 0) {
                setCountdown(processed.waitTimeSeconds);
            }
        }
        if (!opts?.background) {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        modelRef.current = currentModel;
        kindRef.current = currentRequestKind;
        const entry = getCached(currentModel, currentRequestKind);
        if (entry) {
            setRateLimit(entry.processed);
            setIsLoading(false);
            if (!("error" in entry.processed) && entry.processed.waitTimeSeconds > 0) {
                setCountdown(entry.processed.waitTimeSeconds);
            }
            if (cacheAgeMs(entry) > CACHE_TTL_MS) {
                fetchNow({ background: true });
            }
        } else {
            fetchNow();
        }
    }, [currentModel, currentRequestKind, fetchNow]);

    useEffect(() => {
        fetchNow({ background: true });
        let interval: number | undefined;
        if (settings.store.autoRefresh) {
            interval = window.setInterval(() => fetchNow({ background: true }), 60000);
        }
        const onVisibilityChange = () => document.visibilityState === "visible" && fetchNow({ background: true });
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            if (interval) {
                clearInterval(interval);
            }
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [fetchNow]);

    useEffect(() => {
        if (countdown === null || countdown <= 0) {
            return;
        }
        const timer = setInterval(() => {
            setCountdown(prev => {
                const newTime = (prev ?? 1) - 1;
                if (newTime <= 0) {
                    clearInterval(timer);
                    fetchNow();
                    return null;
                }
                return newTime;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown, fetchNow]);

    useEffect(() => {
        const root = querySelector(QUERY_BAR_SELECTOR);
        if (!root) {
            return;
        }

        const trigger = () => {
            window.setTimeout(() => fetchNow({ background: true }), 1500);
        };

        const onKeyDown = (ev: KeyboardEvent) => {
            if (ev.isComposing) {
                return;
            }
            if (ev.key !== "Enter" || ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey) {
                return;
            }
            const target = ev.target as HTMLElement | null;
            if (!target) {
                return;
            }
            const inEditor = !!target.closest(".tiptap.ProseMirror");
            if (inEditor) {
                trigger();
            }
        };

        const onSubmitCapture = () => trigger();

        root.addEventListener("keydown", onKeyDown, true);
        root.addEventListener("submit", onSubmitCapture, true);

        return () => {
            root.removeEventListener("keydown", onKeyDown, true);
            root.removeEventListener("submit", onSubmitCapture, true);
        };
    }, [fetchNow]);

    const formatCountdown = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : "", `${s}s`].filter(Boolean).join(" ");
    };

    if (isLoading && !rateLimit) {
        return (
            <Button
                variant="outline"
                size="md"
                loading
                icon="Loader2"
                tooltip="Fetching rate limits…"
                color="default"
                rounded
                className="rate-limit-display-button"
            />
        );
    }

    if (!rateLimit || "error" in rateLimit) {
        return (
            <Button
                variant="outline"
                size="md"
                loading={false}
                icon="AlertTriangle"
                tooltip="Error fetching rate limits"
                color="danger"
                rounded
                className="rate-limit-display-button"
                onClick={() => fetchNow()}
            />
        );
    }

    const { isBoth, highRemaining, lowRemaining, waitTimeSeconds } = rateLimit;
    const isLimited = (isBoth ? highRemaining === 0 && (lowRemaining ?? 0) === 0 : highRemaining === 0) && waitTimeSeconds > 0;

    const content = isLimited ? (
        formatCountdown(countdown ?? waitTimeSeconds)
    ) : isBoth ? (
        <span className="flex items-center justify-center">
            {highRemaining}
            <Lucide name="Dot" size={16} className="rate-limit-separator mx-px" />
            {lowRemaining ?? 0}
        </span>
    ) : (
        highRemaining.toString()
    );

    const tooltip = isLoading
        ? "Refreshing…"
        : isLimited
            ? `Reset in ${formatCountdown(countdown ?? waitTimeSeconds)}`
            : isBoth
                ? `High: ${highRemaining} | Low: ${lowRemaining ?? 0}`
                : `${highRemaining} queries left`;

    return (
        <Button
            variant="outline"
            size="md"
            loading={isLoading}
            icon={isLimited ? "Clock" : "Droplet"}
            onClick={() => fetchNow()}
            tooltip={tooltip}
            color={isLimited ? "danger" : "default"}
            isActive={isLimited}
            disableIconHover
            rounded
            className="rate-limit-display-button"
        >
            {content}
        </Button>
    );
}

const projectButtonSelector = { selector: "button", svgPartialD: "M3.33965 17L11.9999 22L20.6602 17V7" };
const attachButtonSelector = { selector: "button[aria-label='Attach']" };

const patch = ui({
    target: QUERY_BAR_SELECTOR,
    component: RateLimitDisplay,
    parent: queryBar => {
        const projectButton = findElement({ ...projectButtonSelector, root: queryBar });
        if (projectButton) {
            return projectButton.parentElement;
        }
        const attachButton = findElement({ ...attachButtonSelector, root: queryBar });
        return attachButton?.parentElement ?? null;
    },
    insert: {
        after: parent => {
            const projectButton = findElement({ ...projectButtonSelector, root: parent });
            if (projectButton) {
                return projectButton;
            }
            return findElement({ ...attachButtonSelector, root: parent });
        }
    },
    observerDebounce: 50,
});

export default definePlugin({
    name: "Rate Limit Display",
    description: "Displays the remaining queries for the current model in the chat bar.",
    authors: [Devs.blankspeaker, Devs.CursedAtom, Devs.Prism],
    category: "chat",
    tags: ["rate-limit", "queries", "usage"],
    styles: `
        .rate-limit-display-button:not([class*="text-red-400"]) > svg {
            color: white !important;
        }
        .rate-limit-display-button > svg {
            stroke-width: 2 !important;
        }
        .rate-limit-separator {
            color: #3a3c3e !important;
        }
    `,
    settings,
    patches: [patch]
});
