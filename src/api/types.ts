/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export type Primitive = string | number | boolean | null | undefined | bigint;
export type JsonValue = Primitive | { [k: string]: JsonValue; } | ReadonlyArray<JsonValue>;

export type HeadersInitLike = Record<string, string>;
export type QueryScalar = string | number | boolean;
export type QueryValue = QueryScalar | null | undefined | ReadonlyArray<QueryScalar>;
export type QueryParams = Record<string, QueryValue>;

export interface RetryPolicy {
    retries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    retryOn: number[];
}

export interface CsrfOptions {
    enabled?: boolean;
    headerName?: string;
    getToken?: () => Promise<string | null> | string | null;
}

export interface AuthOptions {
    enabled?: boolean;
    headerName?: string;
    scheme?: string;
    getToken?: () => Promise<string | null> | string | null;
}

export interface CacheOptions {
    etag?: boolean;
    maxEntries?: number;
    ttlMs?: number;
    staleWhileRevalidate?: boolean;
}

export interface ApiConfig {
    baseUrl: string;
    defaultHeaders?: HeadersInitLike;
    includeCredentials?: boolean;
    csrf?: CsrfOptions;
    auth?: AuthOptions;
    cache?: CacheOptions;
    retry?: Partial<RetryPolicy>;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
}

export interface ApiErrorPayload {
    error?: string;
    message?: string;
    code?: string | number;
    [k: string]: JsonValue;
}

export class ApiError<E extends JsonValue = ApiErrorPayload> extends Error {
    readonly status: number;
    readonly method: HttpMethod;
    readonly url: string;
    readonly body: E | null;
    readonly headers: Readonly<Record<string, string>>;
    constructor(init: { status: number; method: HttpMethod; url: string; message: string; body: E | null; headers: Record<string, string>; }) {
        super(init.message);
        this.name = "ApiError";
        this.status = init.status;
        this.method = init.method;
        this.url = init.url;
        this.body = init.body;
        this.headers = Object.freeze({ ...init.headers });
    }
}

export interface SubscriptionsResponse {
    tier: string | null;
    status: string;
    expiresAt?: string | null;
    [k: string]: JsonValue;
}

export interface RateLimitRequest {
    requestKind: string;
    modelName: string;
}

export interface RateLimitData {
    windowSizeSeconds?: number;
    remainingQueries?: number;
    totalQueries?: number;
    remainingTokens?: number;
    totalTokens?: number;
    lowEffortRateLimits?: { cost?: number; remainingQueries?: number; waitTimeSeconds?: number; };
    highEffortRateLimits?: { cost?: number; remainingQueries?: number; waitTimeSeconds?: number; };
    waitTimeSeconds?: number;
    remaining?: number;
    limit?: number;
    resetAt?: string;
    [k: string]: JsonValue;
}

export interface AssetMetadata {
    id: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
    name?: string | null;
    [k: string]: JsonValue;
}

export interface ListAssetsRequest {
    query?: string;
    pageSize?: number;
    pageToken?: string;
    mimeTypes?: ReadonlyArray<string>;
    assetIds?: ReadonlyArray<string>;
    orderBy?: string;
    workspaceId?: string;
    source?: string;
    isLatest?: boolean;
}

export interface ListAssetsResponse {
    assets: ReadonlyArray<AssetMetadata>;
    nextPageToken?: string | null;
}

export interface UserProfile {
    id?: string;
    email?: string | null;
    givenName?: string | null;
    familyName?: string | null;
    avatarUrl?: string | null;
}

export interface UserPlanSummary {
    name: string;
    plan: string;
}

export interface RequestOptions {
    signal?: AbortSignal;
    headers?: HeadersInitLike;
    query?: QueryParams;
    retry?: Partial<RetryPolicy>;
    cacheKey?: string;
    timeoutMs?: number;
    bypassTtl?: boolean;
}

export type RequestInitExt = Omit<RequestInit, "headers"> & { headers?: HeadersInitLike; };

export type SubscriptionsQuery = { provider?: string; status?: string; };

export type RateLimitsPostRequest = { requestKind: string; modelName: string; };

export type WorkspaceIdParam = { workspaceId: string; };
export type WorkspaceConversationAddRequest = { conversationId: string; };
