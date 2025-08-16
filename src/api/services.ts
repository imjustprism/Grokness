/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ApiClient } from "@api/client";
import {
    type ListAssetsRequest,
    type ListAssetsResponse,
    type RateLimitData,
    type RateLimitRequest,
    type RateLimitsPostRequest,
    type SubscriptionsQuery,
    type SubscriptionsResponse,
    type UserProfile,
    type WorkspaceConversationAddRequest,
    type WorkspaceIdParam
} from "@api/types";

export type ApiServices = ReturnType<typeof createApiServices>;

/**
 * Bundle of typed endpoint groups built on top of ApiClient.
 * @param client - ApiClient instance
 * @returns Grouped service methods
 */
export const createApiServices = (client: ApiClient) => {
    const enc = encodeURIComponent;
    const qp = (obj: Record<string, unknown>) => {
        const out: Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>> = {};
        for (const [k, v] of Object.entries(obj)) {
            if (v === undefined || v === null) {
                continue;
            }
            if (Array.isArray(v)) {
                out[k] = (v as Array<unknown>)
                    .filter(x => x !== undefined && x !== null)
                    .map(x => x as string | number | boolean) as ReadonlyArray<string | number | boolean>;
            } else {
                out[k] = v as string | number | boolean;
            }
        }
        return out;
    };
    const req = {
        get: <R>(path: string, signal?: AbortSignal, query?: ReturnType<typeof qp>) =>
            client.get<R>(path, { signal, query }),
        post: <R, B>(path: string, body: B, signal?: AbortSignal, query?: ReturnType<typeof qp>) =>
            client.post<R>(path, body, { signal, query }),
        put: <R, B>(path: string, body: B, signal?: AbortSignal, query?: ReturnType<typeof qp>) =>
            client.put<R>(path, body, { signal, query }),
        patch: <R, B>(path: string, body: B, signal?: AbortSignal, query?: ReturnType<typeof qp>) =>
            client.patch<R>(path, body, { signal, query }),
        del: <R>(path: string, signal?: AbortSignal, query?: ReturnType<typeof qp>) =>
            client.delete<R>(path, { signal, query }),
    } as const;

    const auth = {
        getUser: (signal?: AbortSignal) => client.get<UserProfile>("/rest/auth/get-user", { signal })
    } as const;

    const subscriptions = {
        get: (q: SubscriptionsQuery = {}, signal?: AbortSignal) => client.get<SubscriptionsResponse>("/rest/subscriptions", { signal, query: q })
    } as const;

    const rateLimits = {
        getLegacy: (q: RateLimitRequest, signal?: AbortSignal) =>
            client.get<RateLimitData>("/rate_limits", { signal, query: { requestKind: q.requestKind, modelName: q.modelName } }),
        post: (body: RateLimitsPostRequest, signal?: AbortSignal) => client.post<RateLimitData>("/rest/rate-limits", body, { signal })
    } as const;

    const assets = {
        list: (q: ListAssetsRequest = {}, signal?: AbortSignal) =>
            req.get<ListAssetsResponse>("/rest/assets", signal, qp({
                query: q.query,
                pageSize: q.pageSize,
                pageToken: q.pageToken,
                mimeTypes: q.mimeTypes,
                assetIds: q.assetIds,
                orderBy: q.orderBy,
                workspaceId: q.workspaceId,
                source: q.source,
                isLatest: q.isLatest
            })),
        delete: (p: { assetId: string; }, signal?: AbortSignal) => client.delete<unknown>(`/rest/assets/${encodeURIComponent(p.assetId)}`, { signal })
    } as const;

    const workspaces = {
        addConversation: (p: WorkspaceIdParam, body: WorkspaceConversationAddRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/workspaces/${enc(p.workspaceId)}/conversations`, body, { signal })
    } as const;

    return {
        auth,
        subscriptions,
        rateLimits,
        assets,
        workspaces
    } as const;
};

