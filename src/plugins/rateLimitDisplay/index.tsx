/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokAPI } from "@api/api";
import type { RateLimitData } from "@api/interfaces";
import { IconButton } from "@components/IconButton";
import { Devs } from "@utils/constants";
import { MutationObserverManager, querySelector } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

const logger = new Logger("RateLimitDisplay", "#a6d189");

const MODEL_MAP: Record<string, string> = {
    "Grok 4": "grok-4",
    "Grok 3": "grok-3",
    "Grok 4 Heavy": "grok-4-heavy",
};

const DEFAULT_MODEL = "grok-4";
const POLL_INTERVAL_MS = 60000;
const MODEL_SELECTOR = ".query-bar button span.inline-block.text-primary";
const ATTACH_BUTTON_SELECTOR = '.query-bar button[aria-label="Attach"]';
const QUERY_BAR_SELECTOR = ".query-bar";
const REQUEST_KIND = "DEFAULT";
const DEBOUNCE_DELAY_MS = 100;
const BODY_OBSERVER_DEBOUNCE_MS = 200;

const cachedRateLimits: Record<string, RateLimitData | undefined> = {};
const observerManager = new MutationObserverManager();

function normalizeModelName(rawName: string): string {
    const trimmed = rawName.trim();
    if (!trimmed) {
        logger.warn("Empty model name provided for normalization, using default");
        return DEFAULT_MODEL;
    }
    const normalized = MODEL_MAP[trimmed] || trimmed.toLowerCase().replace(/\s+/g, "-");
    return normalized;
}

async function fetchRateLimit(modelName: string, force: boolean = false): Promise<RateLimitData | null> {
    if (!force) {
        const cached = cachedRateLimits[modelName];
        if (cached !== undefined) {
            return cached;
        }
    }

    try {
        const data = await grokAPI.rateLimits.get({ requestKind: REQUEST_KIND, modelName });
        cachedRateLimits[modelName] = data;
        return data;
    } catch (error) {
        logger.error(`Failed to fetch rate limit for ${modelName}:`, error);
        cachedRateLimits[modelName] = undefined;
        return null;
    }
}

function useCurrentModel(): string {
    const [model, setModel] = useState<string>(DEFAULT_MODEL);

    useEffect(() => {
        const modelSpan = querySelector(MODEL_SELECTOR);
        if (modelSpan) {
            const updateModel = () => {
                const rawName = modelSpan.textContent?.trim() ?? DEFAULT_MODEL;
                const newModel = normalizeModelName(rawName);
                if (newModel !== model) {
                    setModel(newModel);
                }
            };

            const { observe, disconnect } = observerManager.createObserver({
                target: modelSpan,
                options: { childList: true, subtree: true, characterData: true },
                callback: updateModel,
            });

            updateModel();
            observe();

            return () => {
                disconnect();
            };
        } else {
            logger.warn("Model span not found, using default model");
        }
    }, [model]);

    return model;
}

function RateLimitComponent() {
    const currentModel = useCurrentModel();
    const [rateLimit, setRateLimit] = useState<RateLimitData | null>(null);
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const updateRateLimit = async (force: boolean = false) => {
        setIsLoading(true);
        const data = await fetchRateLimit(currentModel, force);
        setRateLimit(data);
        setHasError(!data);
        setIsLoading(false);
        if (!data) {
            logger.warn(`Rate limit data unavailable for model "${currentModel}" after update attempt`);
        }
    };

    useEffect(() => {
        updateRateLimit();

        let intervalId: ReturnType<typeof setInterval> | null = null;

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                updateRateLimit();
                intervalId = setInterval(() => updateRateLimit(), POLL_INTERVAL_MS);
            } else {
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        if (document.visibilityState === "visible") {
            intervalId = setInterval(() => updateRateLimit(), POLL_INTERVAL_MS);
        }

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [currentModel]);

    const handleClick = () => {
        updateRateLimit(true);
    };

    const content = hasError || !rateLimit ? "Unavailable" : `${rateLimit.remainingQueries}/${rateLimit.totalQueries}`;

    return (
        <IconButton
            id="grok-rate-limit"
            as="div"
            variant="outline"
            size="md"
            icon="Gauge"
            loading={isLoading}
            onClick={handleClick}
            aria-label="Rate Limit"
            data-state="closed"
            tooltipContent="Rate Limit"
            toggleGroup="rate-limit"
        >
            {content}
        </IconButton>
    );
}

const RATE_LIMIT_CONTAINER_ID = "grok-rate-limit-container";

const rateLimitPatch: IPatch = (() => {
    let rateLimitRoot: Root | null = null;
    let rateLimitContainer: HTMLDivElement | null = null;
    let queryBarObserverDisconnect: (() => void) | null = null;
    let bodyObserverDisconnect: (() => void) | null = null;

    function mountRateLimit() {
        const attachButton = querySelector(ATTACH_BUTTON_SELECTOR);
        if (!attachButton) {
            logger.warn("Attach button not found, cannot mount rate limit display");
            return;
        }

        const existingContainer = document.getElementById(RATE_LIMIT_CONTAINER_ID);
        if (existingContainer) {
            if (attachButton.parentElement?.contains(existingContainer)) {
                return;
            } else {
                existingContainer.remove();
            }
        }

        unmountRateLimit();
        rateLimitContainer = document.createElement("div");
        rateLimitContainer.id = RATE_LIMIT_CONTAINER_ID;
        attachButton.insertAdjacentElement("afterend", rateLimitContainer);
        rateLimitRoot = createRoot(rateLimitContainer);
        rateLimitRoot.render(<RateLimitComponent />);
    }

    function unmountRateLimit() {
        if (rateLimitRoot) {
            rateLimitRoot.unmount();
            rateLimitRoot = null;
        }
        if (rateLimitContainer) {
            rateLimitContainer.remove();
            rateLimitContainer = null;
        }
    }

    function setupQueryBarObserver(queryBar: HTMLElement) {
        if (queryBarObserverDisconnect) {
            queryBarObserverDisconnect();
            queryBarObserverDisconnect = null;
        }
        const { observe, disconnect } = observerManager.createDebouncedObserver({
            target: queryBar,
            options: { childList: true, subtree: true, attributes: true },
            callback: () => {
                mountRateLimit();
            },
            debounceDelay: DEBOUNCE_DELAY_MS,
        });

        observe();
        queryBarObserverDisconnect = disconnect;
    }

    return {
        apply() {
            const mutationCallback = () => {
                const queryBar = querySelector(QUERY_BAR_SELECTOR);
                if (queryBar) {
                    mountRateLimit();
                    setupQueryBarObserver(queryBar);
                } else {
                    logger.warn("Query bar not found during body mutation check");
                }
            };

            const { observe: bodyObserve, disconnect: bodyDisconnect } = observerManager.createDebouncedObserver({
                target: document.body,
                options: { childList: true, subtree: true },
                callback: mutationCallback,
                debounceDelay: BODY_OBSERVER_DEBOUNCE_MS,
            });

            bodyObserve();
            bodyObserverDisconnect = bodyDisconnect;

            mutationCallback();

            document.addEventListener("visibilitychange", mutationCallback);
        },
        remove() {
            if (queryBarObserverDisconnect) {
                queryBarObserverDisconnect();
                queryBarObserverDisconnect = null;
            }
            if (bodyObserverDisconnect) {
                bodyObserverDisconnect();
                bodyObserverDisconnect = null;
            }
            unmountRateLimit();
            document.removeEventListener("visibilitychange", () => { });
            observerManager.disconnectAll();
        },
    };
})();

export default definePlugin({
    name: "RateLimitDisplay",
    description: "Displays the remaining queries for the current model in the chat bar.",
    authors: [Devs.blankspeaker, Devs.CursedAtom, Devs.Prism],
    category: "chat",
    tags: ["rate-limit", "queries"],
    patches: [rateLimitPatch],
});
