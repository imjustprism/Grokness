/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
    AssetMetadata,
    DeleteAssetRequest,
    GetAssetMetadataRequest,
    ListAssetsRequest,
    ListAssetsResponse,
    ModelsResponse,
    RateLimitData,
    RateLimitRequest,
    SubscriptionsResponse,
    UserData
} from "@api/interfaces";

/**
 * Configuration options for the GrokAPI instance.
 */
export interface GrokAPIConfig {
    /** Base URL for API requests. Defaults to '/rest'. */
    baseURL?: string;
    /** Default headers to include in every request. */
    defaultHeaders?: Record<string, string>;
    /** Optional error handler callback. */
    onError?: (error: Error) => void;
}

/**
 * Modern, modular API client for Grok services.
 * Supports type-safe requests, cancellation, and extensibility.
 */
export class GrokAPI {
    private readonly baseURL: string;
    private readonly defaultHeaders: Record<string, string>;
    private readonly onError?: (error: Error) => void;

    constructor(config: GrokAPIConfig = {}) {
        this.baseURL = config.baseURL ?? "/rest";
        this.defaultHeaders = {
            "Content-Type": "application/json",
            ...config.defaultHeaders,
        };
        this.onError = config.onError;
    }

    /**
     * Internal request method with generics and cancellation support.
     * @param path API endpoint path.
     * @param options Fetch options.
     * @param signal Optional AbortSignal for cancellation.
     * @returns Promise resolving to the typed response data.
     */
    private async request<T>(
        path: string,
        options: RequestInit = {},
        signal?: AbortSignal
    ): Promise<T> {
        const url = `${this.baseURL}${path.startsWith("/") ? path : `/${path}`}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...this.defaultHeaders,
                    ...options.headers,
                },
                signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            if (response.status === 204) {
                return undefined as T;
            }

            return response.json() as Promise<T>;
        } catch (error) {
            if (error instanceof Error) {
                this.onError?.(error);
                throw error;
            }
            const unknownError = new Error("Unknown API error");
            this.onError?.(unknownError);
            throw unknownError;
        }
    }

    /**
     * Authentication-related API methods.
     */
    public readonly auth = {
        /**
         * Fetches current user data.
         * @param signal Optional AbortSignal for cancellation.
         * @returns Promise resolving to UserData.
         */
        getUser: async (signal?: AbortSignal): Promise<UserData> => this.request<UserData>("/auth/get-user", { method: "GET" }, signal),
    } as const;

    /**
     * Subscription-related API methods.
     */
    public readonly subscriptions = {
        /**
         * Fetches user's subscriptions.
         * @param signal Optional AbortSignal for cancellation.
         * @returns Promise resolving to SubscriptionsResponse.
         */
        getSubscriptions: async (signal?: AbortSignal): Promise<SubscriptionsResponse> => this.request<SubscriptionsResponse>("/subscriptions", { method: "GET" }, signal),
    } as const;

    /**
     * Rate limits API methods.
     */
    public readonly rateLimits = {
        /**
         * Fetches rate limit data for a given model.
         * @param params Request parameters.
         * @param signal Optional AbortSignal for cancellation.
         * @returns Promise resolving to RateLimitData.
         */
        get: async (params: RateLimitRequest, signal?: AbortSignal): Promise<RateLimitData> => this.request<RateLimitData>("/rate-limits", {
            method: "POST",
            body: JSON.stringify(params),
        }, signal),
    } as const;

    /**
     * Models API methods.
     */
    public readonly models = {
        /**
         * Fetches available models.
         * @param signal Optional AbortSignal for cancellation.
         * @returns Promise resolving to ModelsResponse.
         */
        getModels: async (signal?: AbortSignal): Promise<ModelsResponse> => this.request<ModelsResponse>("/models", { method: "POST" }, signal),
    } as const;

    /**
     * Asset repository API methods.
     */
    public readonly assetRepository = {
        /**
         * Deletes an asset by its ID.
         * @param params Request parameters including assetId.
         * @param signal Optional AbortSignal for cancellation.
         * @returns Promise resolving to void.
         */
        deleteAsset: async (params: DeleteAssetRequest, signal?: AbortSignal): Promise<void> => {
            if (params.assetId == null) {
                throw new Error('Required parameter "assetId" was null or undefined when calling assetRepositoryDeleteAsset().');
            }
            await this.request<void>(`/assets/${encodeURIComponent(String(params.assetId))}`, { method: "DELETE" }, signal);
        },
        /**
         * Gets metadata for an asset by its ID.
         * @param params Request parameters including assetId.
         * @param signal Optional AbortSignal for cancellation.
         * @returns Promise resolving to AssetMetadata.
         */
        getAssetMetadata: async (params: GetAssetMetadataRequest, signal?: AbortSignal): Promise<AssetMetadata> => {
            if (params.assetId == null) {
                throw new Error('Required parameter "assetId" was null or undefined when calling assetRepositoryGetAssetMetadata().');
            }
            return this.request<AssetMetadata>(`/assets/${encodeURIComponent(String(params.assetId))}`, { method: "GET" }, signal);
        },
        /**
         * Lists assets with pagination and filters.
         * @param params Request parameters for listing.
         * @param signal Optional AbortSignal for cancellation.
         * @returns Promise resolving to ListAssetsResponse.
         */
        listAssets: async (params: ListAssetsRequest = {}, signal?: AbortSignal): Promise<ListAssetsResponse> => {
            const query = new URLSearchParams();
            if (params.pageSize !== undefined) {
                query.append("pageSize", params.pageSize.toString());
            }
            if (params.orderBy) {
                query.append("orderBy", params.orderBy);
            }
            if (params.source) {
                query.append("source", params.source);
            }
            if (params.isLatest !== undefined) {
                query.append("isLatest", params.isLatest.toString());
            }
            if (params.pageToken) {
                query.append("pageToken", params.pageToken);
            }
            const path = `/assets${query.toString() ? `?${query.toString()}` : ""}`;
            return this.request<ListAssetsResponse>(path, { method: "GET" }, signal);
        },
    } as const;
}

/**
 * Default instance of GrokAPI for easy import/use.
 */
export const grokAPI = new GrokAPI();
