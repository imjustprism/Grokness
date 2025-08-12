/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export type Primitive = string | number | boolean | null | undefined | bigint;
export type JsonValue = Primitive | { [k: string]: JsonValue; } | ReadonlyArray<JsonValue>;

/**
 * Headers map used by the ApiClient. Keys are normalized as sent.
 */
export type HeadersInitLike = Record<string, string>;
export type QueryScalar = string | number | boolean;
export type QueryValue = QueryScalar | null | undefined | ReadonlyArray<QueryScalar>;
export type QueryParams = Record<string, QueryValue>;

/**
 * Exponential backoff retry policy
 *
 * @property retries - Maximum number of retry attempts
 * @property baseDelayMs - Initial delay in milliseconds
 * @property maxDelayMs - Maximum backoff delay in milliseconds
 * @property retryOn - HTTP status codes that should trigger a retry
 */
export interface RetryPolicy {
    retries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    retryOn: number[];
}

/**
 * CSRF protection configuration
 *
 * @property enabled - Whether CSRF protection is enabled
 * @property headerName - HTTP header name to carry the token
 * @property getToken - Provider that returns the token synchronously or asynchronously
 */
export interface CsrfOptions {
    enabled?: boolean;
    headerName?: string;
    getToken?: () => Promise<string | null> | string | null;
}

/**
 * Auth header injection configuration
 *
 * @property enabled - Whether auth header injection is enabled
 * @property headerName - Header to write the token to
 * @property scheme - Prefix scheme (e.g., "Bearer")
 * @property getToken - Token provider
 */
export interface AuthOptions {
    enabled?: boolean;
    headerName?: string;
    scheme?: string;
    getToken?: () => Promise<string | null> | string | null;
}

/**
 * Response cache options
 *
 * @property etag - Enable ETag-based caching for GET requests
 * @property maxEntries - Max in-memory cache entries
 */
export interface CacheOptions {
    etag?: boolean;
    maxEntries?: number;
    /** Memory cache TTL for GET responses (ms). 0 disables TTL caching. */
    ttlMs?: number;
    /** When true, serves expired cached data immediately and refreshes in background. */
    staleWhileRevalidate?: boolean;
}

/**
 * ApiClient configuration
 *
 * @property baseUrl - Base URL of the API (no trailing slash required)
 * @property defaultHeaders - Default headers applied to every request
 * @property includeCredentials - Whether to include credentials in cross-site requests
 * @property csrf - CSRF options
 * @property auth - Auth header options
 * @property cache - Response cache options
 * @property retry - Retry policy overrides
 * @property fetchImpl - Custom fetch implementation
 * @property timeoutMs - Default timeout for requests
 */
export interface ApiConfig {
    baseUrl: string;
    defaultHeaders?: HeadersInitLike;
    includeCredentials?: boolean;
    csrf?: CsrfOptions;
    auth?: AuthOptions;
    cache?: CacheOptions;
    retry?: Partial<RetryPolicy>;
    fetchImpl?: typeof fetch;
    /** Default request timeout in milliseconds for all requests (overridable per request) */
    timeoutMs?: number;
}

/**
 * Generic API error payload structure.
 */
export interface ApiErrorPayload {
    /** Short error string */
    error?: string;
    /** Human-readable message */
    message?: string;
    /** Error code (string or numeric) */
    code?: string | number;
    [k: string]: JsonValue;
}

/**
 * Error thrown by ApiClient when a non-retryable HTTP error occurs.
 *
 * @template E - JSON payload type carried by the error
 */
export class ApiError<E extends JsonValue = ApiErrorPayload> extends Error {
    readonly status: number;
    readonly method: HttpMethod;
    readonly url: string;
    readonly body: E | null;
    readonly headers: Readonly<Record<string, string>>;
    /**
     * @param init - Initialization structure for the ApiError
     */
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

export interface ModelsResponse {
    models: ReadonlyArray<string> | ReadonlyArray<{ name: string; id?: string;[k: string]: JsonValue; }>;
}

export type SubscriptionTier =
    | "SUBSCRIPTION_TIER_FREE"
    | "SUBSCRIPTION_TIER_PLUS"
    | "SUBSCRIPTION_TIER_PRO"
    | "SUBSCRIPTION_TIER_ENTERPRISE"
    | string;

export type SubscriptionStatus =
    | "SUBSCRIPTION_STATUS_ACTIVE"
    | "SUBSCRIPTION_STATUS_INACTIVE"
    | "SUBSCRIPTION_STATUS_INVALID"
    | string;

export interface SubscriptionsResponse {
    tier: SubscriptionTier | null;
    status: SubscriptionStatus;
    expiresAt?: string | null;
    [k: string]: JsonValue;
}

export interface RateLimitRequest {
    requestKind: string;
    modelName: string;
}

export interface RateLimitData {
    /** Sliding window size in seconds */
    windowSizeSeconds?: number;
    /** Remaining queries in the current window (generic) */
    remainingQueries?: number;
    /** Total allowed queries in the current window (generic) */
    totalQueries?: number;
    /** Remaining token budget (if applicable) */
    remainingTokens?: number;
    /** Total token budget (if applicable) */
    totalTokens?: number;
    /** Low-effort lane (e.g., grok-3) */
    lowEffortRateLimits?: { cost?: number; remainingQueries?: number; };
    /** High-effort lane (e.g., grok-4) */
    highEffortRateLimits?: { cost?: number; remainingQueries?: number; };
    /** Seconds until rate limit resets (if provided by backend) */
    waitTimeSeconds?: number;
    /** Legacy fields for backwards compatibility */
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

export interface GetAssetMetadataRequest {
    assetId: string;
}

export interface DeleteAssetRequest {
    assetId: string;
}

export interface UserProfile {
    id?: string;
    email?: string | null;
    givenName?: string | null;
    familyName?: string | null;
    avatarUrl?: string | null;
}

/**
 * Minimal user summary for UI surfaces that need only display name and plan.
 */
export interface UserPlanSummary {
    /** Friendly display name */
    name: string;
    /** Human-readable plan label (e.g., "SuperGrok Pro", "SuperGrok", "Enterprise", "Free") */
    plan: string;
}

/**
 * Per-request options for ApiClient.
 * @property signal - AbortSignal to cancel the request
 * @property headers - Additional headers
 * @property query - Query string parameters
 * @property retry - Retry policy overrides
 * @property cacheKey - Cache key override for ETag caching
 * @property timeoutMs - Per-request timeout override
 */
export interface RequestOptions {
    signal?: AbortSignal;
    headers?: HeadersInitLike;
    query?: QueryParams;
    retry?: Partial<RetryPolicy>;
    cacheKey?: string;
    /** Per-request timeout in milliseconds (overrides ApiConfig.timeoutMs when provided) */
    timeoutMs?: number;
    /** Bypass memory TTL cache when true */
    bypassTtl?: boolean;
}

export type RequestInitExt = Omit<RequestInit, "headers"> & { headers?: HeadersInitLike; };

export type AddMobileDeviceTokenRequest = { token: string; deviceType: string; };
export type UserSettingsGetResponse = unknown;
export type UserSettingsUpdateRequest = { excludeFromTraining?: boolean; preferences?: JsonValue; allowXPersonalization?: boolean; enableMemory?: boolean; };
export type IssueReportRequest = { reportJSONString?: string; reportWithDumpJSONString?: string; report?: string; feedbackType: string; };

export type ConversationIdParam = { conversationId: string; };
export type ShareLinkIdParam = { shareLinkId: string; };
export type FileMetadataIdParam = { fileMetadataId: string; };
export type ArtifactIdParam = { artifactId: string; };
export type ArtifactVersionIdParam = { artifactVersionId: string; };
export type ResponseIdParam = { responseId: string; };
export type RootAssetIdParam = { rootAssetId: string; };
export type WorkspaceIdParam = { workspaceId: string; };
export type SystemPromptIdParam = { systemPromptId: string; };
export type TeamIdParam = { teamId: string; };
export type ApiKeyIdParam = { apiKeyId: string; };
export type FinanceTickerParam = { ticker: string; };
export type ExploreItemIdParam = { id: string; };

export type ModelResponseCreateRequest = { message: string; partial?: boolean; parentResponseId?: string;[k: string]: JsonValue; };
export type ResponseCreateRequest = { message: string; modelName?: string;[k: string]: JsonValue; };
export type ToolResponseRequest = { responseId: string; toolResponse: JsonValue; };
export type UserResponseCreateRequest = { message: string; parentResponseId?: string; };
export type AskToShareRequest = { message: string; isPublic?: boolean; };
export type ShareLinkCloneRequest = { name?: string; icon?: string; };
export type ConversationCreateRequest = { systemPromptName?: string; temporary?: boolean; addResponseRequest?: JsonValue;[k: string]: JsonValue; };
export type ConversationCreateNewRequest = { systemPromptName?: string; temporary?: boolean; message: string; modelName?: string;[k: string]: JsonValue; };
export type ConversationUpdateRequest = { title?: string; starred?: boolean; };
export type TitleGenerationRequest = { leafResponseId: string; };
export type ShareConversationRequest = { responseId?: string; teamMembersToShare?: ReadonlyArray<string>; shareWithTeamMembers?: boolean; };
export type ShareArtifactRequest = { responseId: string; artifactId: string; artifactVersionId: string; };
export type ArtifactsMetadataRequest = Record<string, never>;
export type ArtifactPostRequest = { conversationId: string; responseId: string; };
export type LoadResponsesRequest = { responseIds: ReadonlyArray<string>; };
export type RestoreConversationRequest = { conversationId: string; };
export type UploadFileRequest = { fileName: string; fileMimeType: string; content: string; makePublic?: boolean; fileSource?: string; thirdPartyFileId?: string; };
export type FileMetadataPostRequest = Record<string, never>;

export type ConversationsQuery = { conversationIds?: ReadonlyArray<string>; includeWorkspaces?: boolean; includeTaskResult?: boolean; };
export type ConversationsListQuery = { pageSize?: number; pageToken?: string; searchQuery?: string; workspaceId?: string; filterIsStarred?: boolean; };
export type ConversationsDeletedQuery = { pageSize?: number; pageToken?: string; workspaceId?: string; };

export type ImageGenerationsGetResponse = unknown;
export type ShareLinksQuery = { pageSize?: number; pageToken?: string; sharedWithMe?: boolean; conversationId?: string; responseId?: string; };

export type MemoryPostRequest = { conversationIds?: ReadonlyArray<string>; };
export type MemoryDeleteQuery = { conversationIds?: ReadonlyArray<string>; };

export type MigrateConversationsRequest = { conversations: ReadonlyArray<JsonValue>; };
export type MigrateFileRequest = { fileName: string; fileMimeType: string; content: string; };
export type MigrateMemoryRequest = { memoryKeyMappings: ReadonlyArray<JsonValue>; };
export type MigrateResponsesRequest = { responses: ReadonlyArray<JsonValue>; };
export type RunCodeRequest = { language: string; code: string; };
export type GoogleDriveFilesQuery = { query?: string; };
export type GoogleDriveFileGetParam = { id: string; };
export type VoiceShareRequest = { videoBytes: string; text: string; };

export type TasksCreateRequest = { name: string; prompt: string; schedule?: JsonValue;[k: string]: JsonValue; };
export type TasksUpdateRequest = { taskId: string; updatedTask: JsonValue; scheduleId?: string; };
export type TasksArchiveRequest = { taskId: string; isEnabled: boolean; };
export type TaskSchedulesPatchRequest = { taskId: string; schedule: JsonValue; };
export type SchedulePatchRequest = { scheduleId: string; isEnabled: boolean; };
export type TaskResultsQuery = { nextPage?: string; limit?: number; };
export type TaskResultsBatchReadRequest = { taskResultIds?: ReadonlyArray<string>; value?: boolean; };

export type CreateAnonUserRequest = { userPublicKey: string; };
export type CreateAnonUserChallengeRequest = { anonUserId: string; };
export type CreateSessionRequest = { credentials: JsonValue; sessionId?: string; promptOnDuplicateEmail?: boolean; };
export type CreateXIntegrationUserRequest = { xUserId: string; xUsername?: string; };
export type DeleteSessionQuery = { sessionId?: string; };
export type EditUserRequest = { user: JsonValue; fieldMask: string; };
export type GetAuthUrlQuery = { provider?: string; redirectUrl?: string; stateMetadata?: string; domain?: string; };
export type GetTeamQuery = { teamId?: string; returnCreateUser?: boolean; };
export type LinkAccountRequest = { credentials: JsonValue; };
export type RefreshXSubscriptionStatusRequest = { xUserId: string; };
export type ResendEmailValidationEmailRequest = { email: string; };
export type RestoreDeletedUserRequest = { userId: string; };
export type SetBirthDateRequest = { birthDate: string; };
export type SetEmailAddressRequest = { newEmail: string; };
export type SetTosAcceptedRequest = { tosVersion: string; };
export type SetXUserDetailsRequest = { xSubscriptionType?: string; xUsername?: string; };
export type SoftDeleteUserRequest = { userId: string; };
export type StartMfaVerificationRequest = { multiFactorDeviceId: string; domain?: string; };
export type UpdateProfileImageRequest = { profileImage: string; };

export type SubscriptionsQuery = { provider?: string; status?: string; };
export type NewCustomerRequest = { billingInfo: { name: string; email: string; address?: JsonValue; taxIdType?: string; taxNumber?: string; }; };
export type SubscribeNewRequest = { priceId: string; subscriptionType: string; ignoreExistingActiveSubscriptions?: boolean;[k: string]: JsonValue; };
export type BillingPortalRequest = { configuration?: JsonValue; returnUrl?: string; flowData?: JsonValue; };
export type BillingPortalUpdateRequest = { subscriptionId: string; newPriceId: string; returnUrl: string; };
export type ProductsQuery = { provider?: string; };

export type ModelsPostRequest = { locale?: string; };

export type AssetCreateRequest = { name: string; mimeType: string; content: string; makePublic?: boolean; fileSource?: string; thirdPartyFileId?: string; };
export type AssetUpdateRequest = { makeNewVersion?: boolean; name?: string; content?: string; };
export type ResetAssetConversationRequest = Record<string, never>;

export type WorkspacesQuery = { query?: string; pageSize?: number; pageToken?: string; orderBy?: string; };
export type WorkspaceCreateRequest = { name: string; icon?: string; customPersonality?: JsonValue; };
export type WorkspaceUpdateRequest = { name?: string; icon?: string; customPersonality?: JsonValue; isPublic?: boolean; };
export type WorkspaceCloneRequest = { name?: string; icon?: string; };
export type WorkspaceAssetAddRequest = { assetId: string; };
export type WorkspaceConversationAddRequest = { conversationId: string; };
export type WorkspacePublicPermissionRequest = { accessLevel: string; };
export type WorkspaceEmailPermissionRequest = { email: string; accessLevel: string; };

export type SystemPromptCreateRequest = { name: string; content: ReadonlyArray<JsonValue>; };
export type SystemPromptUpdateRequest = { name: string; content: ReadonlyArray<JsonValue>; };
export type SystemPromptListRequest = { query?: string; pageSize?: number; pageToken?: string; orderBy?: string; };

export type LivekitTokensRequest = { conversationId: string; agentName?: string; sessionPayload?: JsonValue; requestAgentDispatch?: boolean; livekitUrl?: string; };

export type RateLimitsPostRequest = { requestKind: string; modelName: string; };

export type TeamsListResponse = unknown;
export type TeamAndRoleGetResponse = unknown;
export type TeamApiKeysQuery = { pageSize?: number; paginationToken?: string; aclFilters?: ReadonlyArray<string>; };
export type CreateApiKeyRequest = { name: string; acls?: ReadonlyArray<string>; qps?: number; qpm?: number; tpm?: number; };
export type UpdateApiKeyRequest = { apiKey: JsonValue; fieldMask: string; };

export type FinanceTimespanParam = { timespan: string; };
export type FinanceTimeframeParam = { timeframe: string; };

export type ExploreItemsRequest = { typeId?: string; limit?: number; cursor?: string; };
export type ExploreTypesQuery = { locale?: string; };

export type LogMetricRequest = JsonValue;
export type VerifyTurnstileRequest = { token: string; };
