/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Request parameters for fetching rate limits.
 */
export interface RateLimitRequest {
    /** The kind of request (e.g., 'DEFAULT'). */
    requestKind: string;
    /** The model name (e.g., 'grok-4'). */
    modelName: string;
}

/**
 * Effort-specific rate limit data.
 */
export interface EffortRateLimits {
    cost?: number;
    waitTimeSeconds?: number;
    remainingQueries?: number;
    totalQueries?: number;
}

/**
 * Response data for rate limits.
 */
export interface RateLimitData {
    /** Optional window size in seconds. */
    windowSizeSeconds?: number;
    /** Remaining queries in the current window. */
    remainingQueries: number;
    /** Optional wait time in seconds if rate limited. */
    waitTimeSeconds?: number;
    /** Total queries allowed in the window. */
    totalQueries: number;
    /** Optional remaining tokens. */
    remainingTokens?: number;
    /** Optional total tokens. */
    totalTokens?: number;
    /** Optional low effort rate limits. */
    lowEffortRateLimits?: EffortRateLimits;
    /** Optional high effort rate limits. */
    highEffortRateLimits?: EffortRateLimits;
}

/**
 * User data from auth endpoint.
 */
export interface UserData {
    userId: string;
    createTime: string;
    email: string;
    profileImage: string;
    givenName: string;
    familyName: string;
    xSubscriptionType: string;
    xUserId: string;
    xUsername: string;
    role: string;
    emailConfirmed: boolean;
    tosAcceptedVersion: number;
    blockedReason?: string;
    aclStrings: string[];
    sessionTierId: string;
    birthDate: string;
    emailDomain: string;
    grokDb: string;
    deleteTime: string | null;
    vercelAvatarUrl?: string;
    vercelEmail?: string;
    vercelId?: string;
    vercelName?: string;
    vercelRole?: string;
    hasPassword: boolean;
    googleEmail: string;
    emailSubscribed: boolean;
    migratedFromX: boolean;
    xMigrationStatus?: string;
}

/**
 * Subscription details.
 */
export interface Subscription {
    /** Subscription tier. */
    tier: SubscriptionTier;
    /** Subscription status. */
    status: SubscriptionStatus;
    /** Optional Google purchase details. */
    google?: { purchaseToken: string; productId: string; };
    /** Optional Apple purchase details. */
    apple?: { originalTxid: string; txid: string; bundleId: string; productId: string; };
    /** Optional Stripe subscription details. */
    stripe?: { subscriptionId: string; invoiceId: string; productId: string; };
    /** Optional X subscription details. */
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    x?: Record<string, any>;
    /** Optional enterprise details. */
    enterprise?: { teamId: string; subscriptionId: string; };
    /** Optional xAI user ID. */
    xaiUserId?: string;
    /** Creation time. */
    createTime?: string;
    /** Modification time. */
    modTime?: string;
}

/**
 * Response from subscriptions endpoint.
 */
export interface SubscriptionsResponse {
    /** List of subscriptions. */
    subscriptions: Subscription[];
}

/**
 * Enum-like object for subscription tiers.
 */
export const SubscriptionTiers = {
    Invalid: "SUBSCRIPTION_TIER_INVALID",
    GrokPro: "SUBSCRIPTION_TIER_GROK_PRO",
    XBasic: "SUBSCRIPTION_TIER_X_BASIC",
    XPremium: "SUBSCRIPTION_TIER_X_PREMIUM",
    XPremiumPlus: "SUBSCRIPTION_TIER_X_PREMIUM_PLUS",
    SuperGrokPro: "SUBSCRIPTION_TIER_SUPER_GROK_PRO"
} as const;

/**
 * Type for subscription tiers.
 */
export type SubscriptionTier = (typeof SubscriptionTiers)[keyof typeof SubscriptionTiers];

/**
 * Enum-like object for subscription statuses.
 */
export const SubscriptionStatuses = {
    Invalid: "SUBSCRIPTION_STATUS_INVALID",
    Active: "SUBSCRIPTION_STATUS_ACTIVE",
    Inactive: "SUBSCRIPTION_STATUS_INACTIVE"
} as const;

/**
 * Type for subscription statuses.
 */
export type SubscriptionStatus = (typeof SubscriptionStatuses)[keyof typeof SubscriptionStatuses];

/**
 * Priority mapping for subscription tiers.
 */
export const tierPriority: Record<SubscriptionTier, number> = {
    [SubscriptionTiers.SuperGrokPro]: 5,
    [SubscriptionTiers.GrokPro]: 4,
    [SubscriptionTiers.XPremiumPlus]: 3,
    [SubscriptionTiers.XPremium]: 2,
    [SubscriptionTiers.XBasic]: 1,
    [SubscriptionTiers.Invalid]: 0,
};

/**
 * Gets the best active subscription tier from the response.
 * @param response Subscriptions response.
 * @returns The highest priority active tier.
 */
export function getBestSubscriptionTier(response: SubscriptionsResponse): SubscriptionTier {
    const activeSubscriptions = response.subscriptions.filter(
        sub => sub.status === SubscriptionStatuses.Active
    );

    return activeSubscriptions.reduce<SubscriptionTier>((bestTier, sub) => {
        const currentTier = sub.tier ?? SubscriptionTiers.Invalid;
        return tierPriority[currentTier] > tierPriority[bestTier]
            ? currentTier
            : bestTier;
    }, SubscriptionTiers.Invalid);
}

/**
 * Gets a friendly display name for the subscription tier.
 * @param tier Subscription tier.
 * @returns Friendly plan name.
 */
export function getFriendlyPlanName(tier: SubscriptionTier): string {
    switch (tier) {
        case SubscriptionTiers.SuperGrokPro:
            return "SuperGrok Heavy";
        case SubscriptionTiers.GrokPro:
            return "SuperGrok";
        case SubscriptionTiers.XPremiumPlus:
            return "Premium+";
        case SubscriptionTiers.XPremium:
            return "Premium";
        case SubscriptionTiers.XBasic:
            return "Basic";
        default:
            return "Free";
    }
}

/**
 * Model information.
 */
export interface Model {
    /** Model ID. */
    modelId: string;
    /** Model name. */
    name: string;
    /** Model description. */
    description: string;
    /** Tags associated with the model. */
    tags: string[];
    /** Badge text for the model. */
    badgeText: string;
}

/**
 * Response from models endpoint.
 */
export interface ModelsResponse {
    /** List of available models. */
    models: Model[];
    /** Default free model. */
    defaultFreeModel: string;
    /** Default pro model. */
    defaultProModel: string;
    /** List of unavailable models. */
    unavailableModels: Model[];
    /** Default anon model. */
    defaultAnonModel: string;
    /** Default heavy model. */
    defaultHeavyModel: string;
}

/**
 * Request parameters for deleting an asset.
 */
export interface DeleteAssetRequest {
    /** The ID of the asset to delete. */
    assetId: string;
}

/**
 * Request parameters for getting asset metadata.
 */
export interface GetAssetMetadataRequest {
    /** The ID of the asset to get metadata for. */
    assetId: string;
}

/**
 * Response data for asset metadata.
 * Note: Structure assumed as a generic object since exact fields are not specified.
 */
export interface AssetMetadata {
    [key: string]: any;
}

/**
 * Asset information for list response.
 */
export interface Asset {
    assetId: string;
    mimeType?: string;
    name?: string;
    sizeBytes?: number;
    createTime?: string;
    lastUseTime?: string;
    summary?: string;
    previewImageKey?: string;
    key?: string;
    auxKeys?: Record<string, string>;
    source?: string;
    isDeleted?: boolean;
    fileSource?: string;
    rootAssetId?: string;
    isModelGenerated?: boolean;
    isLatest?: boolean;
    inlineStatus?: string;
    isRootAssetCreatedByModel?: boolean;
    responseId?: string;
    sourceConversationId?: string;
    rootAssetSourceConversationId?: string;
    [key: string]: any;
}

/**
 * Request parameters for listing assets.
 */
export interface ListAssetsRequest {
    /** Number of assets per page. */
    pageSize?: number;
    /** Order by field (e.g., 'ORDER_BY_LAST_USE_TIME'). */
    orderBy?: string;
    /** Source filter (e.g., 'SOURCE_ANY'). */
    source?: string;
    /** Whether to get latest versions. */
    isLatest?: boolean;
    /** Token for next page. */
    pageToken?: string;
}

/**
 * Response from listing assets endpoint.
 */
export interface ListAssetsResponse {
    assets: Asset[];
    nextPageToken?: string;
}
