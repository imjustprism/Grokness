/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApiClient } from "@api/client";
import { isActiveSubscription, normalizeTier, Tier } from "@api/enums";
import { type ApiServices, createApiServices } from "@api/services";
import type { ListAssetsRequest, ListAssetsResponse, RateLimitData, RateLimitRequest, SubscriptionsResponse, UserPlanSummary, UserProfile } from "@api/types";

/**
 * High-level API facade for plugins.
 *
 * - Encapsulates client configuration and services
 * - Provides ergonomic helpers for common tasks
 * - Keeps plugin code minimal and type-safe
 */
export class GrokApi {
    readonly client: ApiClient;
    readonly services: ApiServices;

    private constructor(client: ApiClient) {
        this.client = client;
        this.services = createApiServices(client);
    }

    static fromWindow(cfg?: Parameters<typeof ApiClient.fromWindow>[0]): GrokApi {
        return new GrokApi(ApiClient.fromWindow(cfg));
    }

    static get shared(): GrokApi {
        const w = globalThis as unknown as { __grokApi?: GrokApi; };
        if (!w.__grokApi) {
            w.__grokApi = GrokApi.fromWindow();
        }
        return w.__grokApi;
    }

    async getCurrentUser(signal?: AbortSignal): Promise<UserProfile> {
        return this.services.auth.getUser(signal);
    }

    async getCurrentSubscriptions(signal?: AbortSignal): Promise<SubscriptionsResponse> {
        return this.services.subscriptions.get({}, signal);
    }

    async getUserAndSubscriptions(signal?: AbortSignal): Promise<{ user: UserProfile; subscriptions: SubscriptionsResponse | null; }> {
        const [userRes, subsRes] = await Promise.allSettled([
            this.getCurrentUser(signal),
            this.getCurrentSubscriptions(signal),
        ]);
        return {
            user: userRes.status === "fulfilled" ? userRes.value : {},
            subscriptions: subsRes.status === "fulfilled" ? subsRes.value : null,
        };
    }

    async getRateLimit(data: RateLimitRequest, signal?: AbortSignal): Promise<RateLimitData | null> {
        try {
            return await this.services.rateLimits.post({ requestKind: data.requestKind, modelName: data.modelName }, signal);
        } catch {
            try {
                return await this.services.rateLimits.getLegacy(data, signal);
            } catch {
                return null;
            }
        }
    }

    async listAllAssets(query: ListAssetsRequest = {}, signal?: AbortSignal): Promise<ReadonlyArray<ListAssetsResponse["assets"][number]>> {
        const collected: Array<ListAssetsResponse["assets"][number]> = [];
        let pageToken: string | undefined = undefined;
        do {
            const res: ListAssetsResponse = await this.services.assets.list({ ...query, pageToken }, signal);
            collected.push(...res.assets);
            pageToken = res.nextPageToken ?? undefined;
        } while (pageToken && !(signal?.aborted ?? false));
        return collected;
    }

    /**
     * Return a minimal user+plan summary suitable for UI.
     */
    async getUserPlanSummary(signal?: AbortSignal): Promise<UserPlanSummary> {
        const DEFAULT_NAME = "User";
        const DEFAULT_PLAN = "Free";
        try {
            const { user, subscriptions } = await this.getUserAndSubscriptions(signal);
            const u = user as Partial<{ givenName: string; familyName: string; email: string; }>;
            const displayName = (`${u.givenName ?? ""} ${u.familyName ?? ""}`.trim() || (u.email?.split?.("@")[0]) || DEFAULT_NAME);
            const subs = normalizeSubsForPlan(subscriptions);
            const plan = computePlanLabel(subs, user) ?? DEFAULT_PLAN;
            return { name: displayName, plan };
        } catch {
            return { name: DEFAULT_NAME, plan: DEFAULT_PLAN };
        }
    }
}

/**
 * Factory for a shared, ready-to-use API facade.
 *
 * Usage in plugins:
 *   import { grokApi } from "@api";
 *   const user = await grokApi.getCurrentUser();
 */
export const grokApi = GrokApi.shared;

type SubscriptionLike = { tier?: unknown; status?: unknown; enterprise?: boolean | null; };

function normalizeSubsForPlan(raw: unknown): ReadonlyArray<SubscriptionLike> {
    if (Array.isArray(raw)) {
        return raw as ReadonlyArray<SubscriptionLike>;
    }
    if (raw && typeof raw === "object") {
        const o = raw as Record<string, unknown>;
        if (Array.isArray(o.subscriptions)) {
            return o.subscriptions as ReadonlyArray<SubscriptionLike>;
        }
        return [raw as SubscriptionLike];
    }
    return [];
}

function computePlanLabel(subs: ReadonlyArray<SubscriptionLike>, user: unknown): string | null {
    const isProPlus = subs.some(s => normalizeTier(s.tier) === Tier.SuperGrokPro && isActiveSubscription(s.status));
    const isPro = subs.some(s => normalizeTier(s.tier) === Tier.GrokPro && isActiveSubscription(s.status));
    const isEnterprise = subs.some(s => !!s.enterprise && isActiveSubscription(s.status));
    const isXPremiumPlus = String((user as { xSubscriptionType?: unknown; } | undefined)?.xSubscriptionType ?? "").trim() === "PremiumPlus";
    if (isProPlus) {
        return "SuperGrok Pro";
    }
    if (isPro || isXPremiumPlus) {
        return "SuperGrok";
    }
    if (isEnterprise) {
        return "Enterprise";
    }
    return null;
}
