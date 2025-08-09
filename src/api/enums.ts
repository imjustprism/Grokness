/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const Tier = {
    Invalid: "SUBSCRIPTION_TIER_INVALID",
    GrokPro: "SUBSCRIPTION_TIER_GROK_PRO",
    XBasic: "SUBSCRIPTION_TIER_X_BASIC",
    XPremium: "SUBSCRIPTION_TIER_X_PREMIUM",
    XPremiumPlus: "SUBSCRIPTION_TIER_X_PREMIUM_PLUS",
    SuperGrokPro: "SUBSCRIPTION_TIER_SUPER_GROK_PRO"
} as const;

export type SubscriptionTierCode = typeof Tier[keyof typeof Tier];

export const Status = {
    Invalid: "SUBSCRIPTION_STATUS_INVALID",
    Active: "SUBSCRIPTION_STATUS_ACTIVE",
    Inactive: "SUBSCRIPTION_STATUS_INACTIVE"
} as const;

export type SubscriptionStatusCode = typeof Status[keyof typeof Status];

const TierAliases: Record<string, SubscriptionTierCode> = {
    subscriptiontierinvalid: Tier.Invalid,
    subscriptiontiergrokpro: Tier.GrokPro,
    subscriptiontiersupergrokpro: Tier.SuperGrokPro,
    subscriptiontierxbasic: Tier.XBasic,
    subscriptiontierx_basic: Tier.XBasic,
    subscriptiontierxpremium: Tier.XPremium,
    subscriptiontierx_premium: Tier.XPremium,
    subscriptiontierxpremiumplus: Tier.XPremiumPlus,
    subscriptiontierx_premium_plus: Tier.XPremiumPlus,
    subscription_tier_invalid: Tier.Invalid,
    subscription_tier_grok_pro: Tier.GrokPro,
    subscription_tier_super_grok_pro: Tier.SuperGrokPro,
    subscription_tier_x_basic: Tier.XBasic,
    subscription_tier_x_premium: Tier.XPremium,
    subscription_tier_x_premium_plus: Tier.XPremiumPlus
};

const StatusAliases: Record<string, SubscriptionStatusCode> = {
    subscriptionstatusinvalid: Status.Invalid,
    subscriptionstatusactive: Status.Active,
    subscriptionstatusinactive: Status.Inactive,
    subscription_status_invalid: Status.Invalid,
    subscription_status_active: Status.Active,
    subscription_status_inactive: Status.Inactive
};

export const normalizeTier = (input: unknown): SubscriptionTierCode | null => {
    if (!input) {
        return null;
    }
    const v = String(input).trim();
    if ((Object.values(Tier) as string[]).includes(v)) {
        return v as SubscriptionTierCode;
    }
    const key = v.replace(/[^A-Za-z_]/g, "").toLowerCase();
    return TierAliases[key] ?? null;
};

export const normalizeStatus = (input: unknown): SubscriptionStatusCode | null => {
    if (!input) {
        return null;
    }
    const v = String(input).trim();
    if ((Object.values(Status) as string[]).includes(v)) {
        return v as SubscriptionStatusCode;
    }
    const key = v.replace(/[^A-Za-z_]/g, "").toLowerCase();
    return StatusAliases[key] ?? null;
};

export const isActiveSubscription = (status?: unknown): boolean => normalizeStatus(status) === Status.Active;
