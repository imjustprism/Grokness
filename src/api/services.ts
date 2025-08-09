/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ApiClient } from "@api/client";
import {
    type AddMobileDeviceTokenRequest,
    type ApiKeyIdParam,
    type ArtifactIdParam,
    type ArtifactPostRequest,
    type ArtifactsMetadataRequest,
    type ArtifactVersionIdParam,
    type AskToShareRequest,
    type AssetCreateRequest,
    type AssetUpdateRequest,
    type BillingPortalRequest,
    type BillingPortalUpdateRequest,
    type ConversationCreateNewRequest,
    type ConversationCreateRequest,
    type ConversationIdParam,
    type ConversationsDeletedQuery,
    type ConversationsListQuery,
    type ConversationsQuery,
    type ConversationUpdateRequest,
    type CreateAnonUserChallengeRequest,
    type CreateAnonUserRequest,
    type CreateApiKeyRequest,
    type CreateSessionRequest,
    type CreateXIntegrationUserRequest,
    type DeleteAssetRequest,
    type DeleteSessionQuery,
    type EditUserRequest,
    type ExploreItemIdParam,
    type ExploreItemsRequest,
    type ExploreTypesQuery,
    type FileMetadataIdParam,
    type FileMetadataPostRequest,
    type FinanceTickerParam,
    type FinanceTimeframeParam,
    type FinanceTimespanParam,
    type GetAssetMetadataRequest,
    type GetAuthUrlQuery,
    type GetTeamQuery,
    type GoogleDriveFileGetParam,
    type GoogleDriveFilesQuery,
    type ImageGenerationsGetResponse,
    type IssueReportRequest,
    type LinkAccountRequest,
    type ListAssetsRequest,
    type ListAssetsResponse,
    type LivekitTokensRequest,
    type LoadResponsesRequest,
    type LogMetricRequest,
    type MemoryDeleteQuery,
    type MemoryPostRequest,
    type MigrateConversationsRequest,
    type MigrateFileRequest,
    type MigrateMemoryRequest,
    type MigrateResponsesRequest,
    type ModelResponseCreateRequest,
    type ModelsPostRequest,
    type ModelsResponse,
    type NewCustomerRequest,
    type ProductsQuery,
    type RateLimitData,
    type RateLimitRequest,
    type RateLimitsPostRequest,
    type RefreshXSubscriptionStatusRequest,
    type ResendEmailValidationEmailRequest,
    type ResetAssetConversationRequest,
    type ResponseCreateRequest,
    type ResponseIdParam,
    type RestoreConversationRequest,
    type RestoreDeletedUserRequest,
    type RootAssetIdParam,
    type RunCodeRequest,
    type SchedulePatchRequest,
    type SetBirthDateRequest,
    type SetEmailAddressRequest,
    type SetTosAcceptedRequest,
    type SetXUserDetailsRequest,
    type ShareArtifactRequest,
    type ShareConversationRequest,
    type ShareLinkCloneRequest,
    type ShareLinkIdParam,
    type ShareLinksQuery,
    type SoftDeleteUserRequest,
    type StartMfaVerificationRequest,
    type SubscribeNewRequest,
    type SubscriptionsQuery,
    type SubscriptionsResponse,
    type SystemPromptCreateRequest,
    type SystemPromptIdParam,
    type SystemPromptListRequest,
    type SystemPromptUpdateRequest,
    type TaskResultsBatchReadRequest,
    type TaskResultsQuery,
    type TasksArchiveRequest,
    type TaskSchedulesPatchRequest,
    type TasksCreateRequest,
    type TasksUpdateRequest,
    type TeamAndRoleGetResponse,
    type TeamApiKeysQuery,
    type TeamIdParam,
    type TeamsListResponse,
    type TitleGenerationRequest,
    type ToolResponseRequest,
    type UpdateApiKeyRequest,
    type UpdateProfileImageRequest,
    type UploadFileRequest,
    type UserProfile,
    type UserResponseCreateRequest,
    type UserSettingsGetResponse,
    type UserSettingsUpdateRequest,
    type VerifyTurnstileRequest,
    type VoiceShareRequest,
    type WorkspaceAssetAddRequest,
    type WorkspaceCloneRequest,
    type WorkspaceConversationAddRequest,
    type WorkspaceCreateRequest,
    type WorkspaceEmailPermissionRequest,
    type WorkspaceIdParam,
    type WorkspacePublicPermissionRequest,
    type WorkspacesQuery,
    type WorkspaceUpdateRequest
} from "@api/types";

export type ApiServices = ReturnType<typeof createApiServices>;

export const createApiServices = (client: ApiClient) => {
    const settings = {
        addMobileDeviceToken: (body: AddMobileDeviceTokenRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/add-mobile-device-notification-token", body, { signal }),
        getUserSettings: (signal?: AbortSignal) => client.get<UserSettingsGetResponse>("/rest/user-settings", { signal }),
        updateUserSettings: (body: UserSettingsUpdateRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/user-settings", body, { signal }),
        issueReport: (body: IssueReportRequest, signal?: AbortSignal) => client.post<unknown>("/rest/issue-report", body, { signal })
    } as const;

    const chat = {
        createModelResponse: (p: ConversationIdParam, body: ModelResponseCreateRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}/model-responses`, body, { signal }),
        createResponse: (p: ConversationIdParam, body: ResponseCreateRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}/responses`, body, { signal }),
        toolResponse: (body: ToolResponseRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/app-chat/tool-responses", body, { signal }),
        createUserResponse: (p: ConversationIdParam, body: UserResponseCreateRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}/user-responses`, body, { signal }),
        askToShare: (p: ConversationIdParam, body: AskToShareRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}/ask-to-share`, body, { signal }),
        cloneShareLink: (p: ShareLinkIdParam, body: ShareLinkCloneRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/app-chat/share_links/${encodeURIComponent(p.shareLinkId)}/clone`, body, { signal }),
        createConversation: (body: ConversationCreateRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/app-chat/conversations", body, { signal }),
        createConversationNew: (body: ConversationCreateNewRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/app-chat/conversations/new", body, { signal }),
        deleteConversation: (p: ConversationIdParam, signal?: AbortSignal) =>
            client.delete<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}`, { signal }),
        softDeleteConversation: (p: ConversationIdParam, signal?: AbortSignal) =>
            client.delete<unknown>(`/rest/app-chat/conversations/soft/${encodeURIComponent(p.conversationId)}`, { signal }),
        restoreConversation: (body: RestoreConversationRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/app-chat/conversations/restore", body, { signal }),
        updateConversation: (p: ConversationIdParam, body: ConversationUpdateRequest, signal?: AbortSignal) =>
            client.put<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}`, body, { signal }),
        generateTitle: (p: ConversationIdParam, body: TitleGenerationRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}/title`, body, { signal }),
        shareConversation: (p: ConversationIdParam, body: ShareConversationRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}/share`, body, { signal }),
        shareArtifact: (p: ConversationIdParam, body: ShareArtifactRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}/share_artifact`, body, { signal }),
        artifactsMetadata: (p: ConversationIdParam, body: ArtifactsMetadataRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}/artifacts_metadata`, body, { signal }),
        postArtifact: (p: ArtifactIdParam, body: ArtifactPostRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/app-chat/artifacts/${encodeURIComponent(p.artifactId)}`, body, { signal }),
        getArtifactContent: (p: ArtifactVersionIdParam, signal?: AbortSignal) =>
            client.get<unknown>(`/rest/app-chat/artifact_content/${encodeURIComponent(p.artifactVersionId)}`, { signal }),
        listConversationResponses: (p: ConversationIdParam, signal?: AbortSignal) =>
            client.get<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}/responses`, { signal }),
        loadResponses: (p: ConversationIdParam, body: LoadResponsesRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}/load-responses`, body, { signal }),
        getResponseNode: (p: ConversationIdParam, signal?: AbortSignal) =>
            client.get<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}/response-node`, { signal }),
        stopInflightResponses: (p: ConversationIdParam, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/app-chat/conversations/${encodeURIComponent(p.conversationId)}/stop-inflight-responses`, {}, { signal }),
        deleteInflightResponse: (p: ResponseIdParam, signal?: AbortSignal) =>
            client.delete<unknown>(`/rest/app-chat/conversations/inflight-response/${encodeURIComponent(p.responseId)}`, { signal }),
        conversationExists: (p: ConversationIdParam, signal?: AbortSignal) =>
            client.get<{ exists: boolean; }>(`/rest/app-chat/conversations/exists/${encodeURIComponent(p.conversationId)}`, { signal }),
        getConversationV2: (p: ConversationIdParam, signal?: AbortSignal) =>
            client.get<unknown>(`/rest/app-chat/conversations_v2/${encodeURIComponent(p.conversationId)}`, { signal }),
        getConversationsMany: (q: ConversationsQuery = {}, signal?: AbortSignal) =>
            client.get<unknown>("/rest/app-chat/conversations-many", { signal, query: { conversationIds: q.conversationIds, includeWorkspaces: q.includeWorkspaces, includeTaskResult: q.includeTaskResult } }),
        listConversations: (q: ConversationsListQuery = {}, signal?: AbortSignal) =>
            client.get<unknown>("/rest/app-chat/conversations", { signal, query: q }),
        listDeletedConversations: (q: ConversationsDeletedQuery = {}, signal?: AbortSignal) =>
            client.get<unknown>("/rest/app-chat/conversations/deleted", { signal, query: q }),
        uploadFile: (body: UploadFileRequest, signal?: AbortSignal) => client.post<unknown>("/rest/app-chat/upload-file", body, { signal }),
        postFileMetadata: (p: FileMetadataIdParam, body: FileMetadataPostRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/app-chat/file-metadata/${encodeURIComponent(p.fileMetadataId)}`, body, { signal }),
        listImageGenerations: (signal?: AbortSignal) => client.get<ImageGenerationsGetResponse>("/rest/app-chat/image-generations", { signal }),
        listShareLinks: (q: ShareLinksQuery = {}, signal?: AbortSignal) => client.get<unknown>("/rest/app-chat/share_links", { signal, query: q }),
        getShareLink: (p: ShareLinkIdParam, signal?: AbortSignal) => client.get<unknown>(`/rest/app-chat/share_links/${encodeURIComponent(p.shareLinkId)}`, { signal }),
        deleteShareLink: (p: ShareLinkIdParam, signal?: AbortSignal) => client.delete<unknown>(`/rest/app-chat/share_links/${encodeURIComponent(p.shareLinkId)}`, { signal }),
        getSharedArtifact: (p: { sharedArtifactId: string; }, signal?: AbortSignal) =>
            client.get<unknown>(`/rest/app-chat/shared_artifacts/${encodeURIComponent(p.sharedArtifactId)}`, { signal }),
        postMemory: (body: MemoryPostRequest, signal?: AbortSignal) => client.post<unknown>("/rest/app-chat/memory", body, { signal }),
        deleteMemory: (q: MemoryDeleteQuery = {}, signal?: AbortSignal) => client.delete<unknown>("/rest/app-chat/memory", { signal, query: { conversationIds: q.conversationIds } }),
        migrateConversations: (body: MigrateConversationsRequest, signal?: AbortSignal) => client.post<unknown>("/rest/app-chat/migrate-conversations", body, { signal }),
        migrateFile: (body: MigrateFileRequest, signal?: AbortSignal) => client.post<unknown>("/rest/app-chat/migrate-file", body, { signal }),
        migrateMemory: (body: MigrateMemoryRequest, signal?: AbortSignal) => client.post<unknown>("/rest/app-chat/migrate-memory", body, { signal }),
        migrateResponses: (body: MigrateResponsesRequest, signal?: AbortSignal) => client.post<unknown>("/rest/app-chat/migrate-responses", body, { signal }),
        runCode: (body: RunCodeRequest, signal?: AbortSignal) => client.post<unknown>("/rest/app-chat/run-code", body, { signal }),
        googleDriveList: (q: GoogleDriveFilesQuery = {}, signal?: AbortSignal) => client.get<unknown>("/rest/app-chat/google-drive/files", { signal, query: q }),
        googleDriveGet: (p: GoogleDriveFileGetParam, signal?: AbortSignal) => client.get<unknown>(`/rest/app-chat/google-drive/files/${encodeURIComponent(p.id)}`, { signal }),
        voiceShare: (body: VoiceShareRequest, signal?: AbortSignal) => client.post<unknown>("/rest/app-chat/voice/share", body, { signal })
    } as const;

    const tasks = {
        list: (signal?: AbortSignal) => client.get<unknown>("/rest/tasks", { signal }),
        create: (body: TasksCreateRequest, signal?: AbortSignal) => client.post<unknown>("/rest/tasks", body, { signal }),
        update: (body: TasksUpdateRequest, signal?: AbortSignal) => client.put<unknown>("/rest/tasks", body, { signal }),
        archive: (body: TasksArchiveRequest, signal?: AbortSignal) => client.put<unknown>("/rest/tasks/archive", body, { signal }),
        inactive: (signal?: AbortSignal) => client.get<unknown>("/rest/tasks/inactive", { signal }),
        results: (p: { taskId: string; }, q: TaskResultsQuery = {}, signal?: AbortSignal) =>
            client.get<unknown>(`/rest/tasks/results/${encodeURIComponent(p.taskId)}`, { signal, query: q }),
        latestResults: (p: { taskId: string; }, q: TaskResultsQuery = {}, signal?: AbortSignal) =>
            client.get<unknown>(`/rest/tasks/latest/results/${encodeURIComponent(p.taskId)}`, { signal, query: q }),
        stat: (signal?: AbortSignal) => client.get<unknown>("/rest/tasks/stat", { signal }),
        usage: (signal?: AbortSignal) => client.get<unknown>("/rest/tasks/usage", { signal }),
        tools: (signal?: AbortSignal) => client.get<unknown>("/rest/task/tools", { signal }),
        taskSchedulesPatch: (body: TaskSchedulesPatchRequest, signal?: AbortSignal) => client.patch<unknown>("/rest/task/task-schedules", body, { signal }),
        schedulesPatch: (body: SchedulePatchRequest, signal?: AbortSignal) => client.patch<unknown>("/rest/task-schedules", body, { signal }),
        byConversation: (p: { conversationId: string; }, signal?: AbortSignal) =>
            client.get<unknown>(`/rest/tasks/conversation/${encodeURIComponent(p.conversationId)}`, { signal }),
        responsesByConversation: (p: { conversationId: string; }, signal?: AbortSignal) =>
            client.get<unknown>(`/rest/tasks/responses/${encodeURIComponent(p.conversationId)}`, { signal }),
        resultsBatchRead: (body: TaskResultsBatchReadRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/tasks/results/batch/is-read", body, { signal })
    } as const;

    const auth = {
        createAnonUser: (body: CreateAnonUserRequest, signal?: AbortSignal) => client.post<unknown>("/rest/auth/create-anon-user", body, { signal }),
        createAnonUserChallenge: (body: CreateAnonUserChallengeRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/auth/create-anon-user-challenge", body, { signal }),
        createSession: (body: CreateSessionRequest, signal?: AbortSignal) => client.post<unknown>("/rest/auth/create-session", body, { signal }),
        createSessionV2: (body: CreateSessionRequest, signal?: AbortSignal) => client.post<unknown>("/rest/auth/create-session-v2", body, { signal }),
        createXIntegrationUser: (body: CreateXIntegrationUserRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/auth/create-x-integration-user", body, { signal }),
        deleteSession: (q: DeleteSessionQuery = {}, signal?: AbortSignal) => client.delete<unknown>("/rest/auth/delete-session", { signal, query: q }),
        editUser: (body: EditUserRequest, signal?: AbortSignal) => client.post<unknown>("/rest/auth/edit-user", body, { signal }),
        getAuthStatus: (signal?: AbortSignal) => client.get<unknown>("/rest/auth/get-auth-status", { signal }),
        getAuthUrl: (q: GetAuthUrlQuery = {}, signal?: AbortSignal) => client.get<unknown>("/rest/get-auth-url", { signal, query: q }),
        getTeam: (q: GetTeamQuery = {}, signal?: AbortSignal) => client.get<unknown>("/rest/auth/get-team", { signal, query: q }),
        getUser: (signal?: AbortSignal) => client.get<UserProfile>("/rest/auth/get-user", { signal }),
        linkAccount: (body: LinkAccountRequest, signal?: AbortSignal) => client.post<unknown>("/rest/auth/link-account", body, { signal }),
        listMfaDevices: (signal?: AbortSignal) => client.get<unknown>("/rest/auth/list-mfa-devices", { signal }),
        listOauthConnectors: (signal?: AbortSignal) => client.get<unknown>("/rest/auth/list-oauth-connectors", { signal }),
        listTeams: (signal?: AbortSignal) => client.get<unknown>("/rest/auth/list-teams", { signal }),
        refreshXSubscriptionStatus: (body: RefreshXSubscriptionStatusRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/auth/refresh-x-subscription-status", body, { signal }),
        resendEmailValidationEmail: (body: ResendEmailValidationEmailRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/auth/resend-email-validation-email", body, { signal }),
        restoreDeletedUser: (body: RestoreDeletedUserRequest, signal?: AbortSignal) => client.post<unknown>("/rest/auth/restore-deleted-user", body, { signal }),
        setBirthDate: (body: SetBirthDateRequest, signal?: AbortSignal) => client.post<unknown>("/rest/auth/set-birth-date", body, { signal }),
        setEmailAddress: (body: SetEmailAddressRequest, signal?: AbortSignal) => client.post<unknown>("/rest/auth/set-email-address", body, { signal }),
        setTosAccepted: (body: SetTosAcceptedRequest, signal?: AbortSignal) => client.post<unknown>("/rest/auth/set-tos-accepted", body, { signal }),
        setXUserDetails: (body: SetXUserDetailsRequest, signal?: AbortSignal) => client.post<unknown>("/rest/auth/set-x-user-details", body, { signal }),
        softDeleteUser: (body: SoftDeleteUserRequest, signal?: AbortSignal) => client.post<unknown>("/rest/auth/soft-delete-user", body, { signal }),
        startMfaVerification: (body: StartMfaVerificationRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/auth/start-mfa-verification", body, { signal }),
        updateProfileImage: (body: UpdateProfileImageRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/auth/update-profile-image", body, { signal })
    } as const;

    const subscriptions = {
        get: (q: SubscriptionsQuery = {}, signal?: AbortSignal) => client.get<SubscriptionsResponse>("/rest/subscriptions", { signal, query: q }),
        newCustomer: (body: NewCustomerRequest, signal?: AbortSignal) => client.post<unknown>("/rest/subscriptions/customer/new", body, { signal }),
        subscribeNew: (body: SubscribeNewRequest, signal?: AbortSignal) => client.post<unknown>("/rest/subscriptions/subscribe/new", body, { signal }),
        billingPortal: (body: BillingPortalRequest, signal?: AbortSignal) => client.post<unknown>("/rest/subscriptions/billing-portal", body, { signal }),
        billingPortalUpdate: (body: BillingPortalUpdateRequest, signal?: AbortSignal) =>
            client.post<unknown>("/rest/subscriptions/billing-portal/update", body, { signal }),
        products: (q: ProductsQuery = {}, signal?: AbortSignal) => client.get<unknown>("/rest/products", { signal, query: q })
    } as const;

    const models = {
        list: (signal?: AbortSignal) => client.get<ModelsResponse>("/rest/models", { signal }),
        post: (body: ModelsPostRequest, signal?: AbortSignal) => client.post<ModelsResponse>("/rest/models", body, { signal })
    } as const;

    const assets = {
        list: (q: ListAssetsRequest = {}, signal?: AbortSignal) =>
            client.get<ListAssetsResponse>("/rest/assets", {
                signal,
                query: {
                    query: q.query,
                    pageSize: q.pageSize,
                    pageToken: q.pageToken,
                    mimeTypes: q.mimeTypes,
                    assetIds: q.assetIds,
                    orderBy: q.orderBy,
                    workspaceId: q.workspaceId,
                    source: q.source,
                    isLatest: q.isLatest
                }
            }),
        create: (body: AssetCreateRequest, signal?: AbortSignal) => client.post<unknown>("/rest/assets", body, { signal }),
        get: (p: { assetId: string; }, signal?: AbortSignal) => client.get<unknown>(`/rest/assets/${encodeURIComponent(p.assetId)}`, { signal }),
        update: (p: { assetId: string; }, body: AssetUpdateRequest, signal?: AbortSignal) =>
            client.put<unknown>(`/rest/assets/${encodeURIComponent(p.assetId)}`, body, { signal }),
        delete: (p: { assetId: string; }, signal?: AbortSignal) => client.delete<unknown>(`/rest/assets/${encodeURIComponent(p.assetId)}`, { signal }),
        clone: (p: { assetId: string; }, signal?: AbortSignal) => client.post<unknown>(`/rest/assets/${encodeURIComponent(p.assetId)}/clone`, {}, { signal }),
        restore: (p: { assetId: string; }, signal?: AbortSignal) => client.post<unknown>(`/rest/assets/${encodeURIComponent(p.assetId)}/restore`, {}, { signal }),
        resetConversation: (p: { assetId: string; }, body: ResetAssetConversationRequest, signal?: AbortSignal) =>
            client.put<unknown>(`/rest/assets/${encodeURIComponent(p.assetId)}/reset-conversation`, body, { signal }),
        share: (p: { assetId: string; }, signal?: AbortSignal) => client.post<unknown>(`/rest/assets/${encodeURIComponent(p.assetId)}/share`, {}, { signal }),
        latest: (p: RootAssetIdParam, signal?: AbortSignal) => client.get<unknown>(`/rest/assets/${encodeURIComponent(p.rootAssetId)}/latest`, { signal }),
        versions: (p: RootAssetIdParam, signal?: AbortSignal) => client.get<unknown>(`/rest/assets/${encodeURIComponent(p.rootAssetId)}/versions`, { signal }),
        search: (
            q: { query?: string; pageSize?: number; pageToken?: string; mimeTypes?: ReadonlyArray<string>; source?: string; } = {},
            signal?: AbortSignal
        ) => client.get<unknown>("/rest/assets/search", { signal, query: { query: q.query, pageSize: q.pageSize, pageToken: q.pageToken, mimeTypes: q.mimeTypes, source: q.source } }),
        storageUsage: (signal?: AbortSignal) => client.get<unknown>("/rest/assets/storage-usage", { signal }),
        deleteMetadata: (p: { assetId: string; }, signal?: AbortSignal) =>
            client.delete<unknown>(`/rest/assets-metadata/${encodeURIComponent(p.assetId)}`, { signal }),
        legacyList: (signal?: AbortSignal) => client.get<ListAssetsResponse>("/assets", { signal }),
        legacyGetMetadata: (p: GetAssetMetadataRequest, signal?: AbortSignal) => client.get<unknown>(`/assets/${encodeURIComponent(p.assetId)}`, { signal }),
        legacyDelete: (p: DeleteAssetRequest, signal?: AbortSignal) => client.delete<unknown>(`/assets/${encodeURIComponent(p.assetId)}`, { signal })
    } as const;

    const workspaces = {
        list: (q: WorkspacesQuery = {}, signal?: AbortSignal) => client.get<unknown>("/rest/workspaces", { signal, query: q }),
        create: (body: WorkspaceCreateRequest, signal?: AbortSignal) => client.post<unknown>("/rest/workspaces", body, { signal }),
        get: (p: WorkspaceIdParam, signal?: AbortSignal) => client.get<unknown>(`/rest/workspaces/${encodeURIComponent(p.workspaceId)}`, { signal }),
        update: (p: WorkspaceIdParam, body: WorkspaceUpdateRequest, signal?: AbortSignal) =>
            client.put<unknown>(`/rest/workspaces/${encodeURIComponent(p.workspaceId)}`, body, { signal }),
        delete: (p: WorkspaceIdParam, signal?: AbortSignal) => client.delete<unknown>(`/rest/workspaces/${encodeURIComponent(p.workspaceId)}`, { signal }),
        clone: (p: WorkspaceIdParam, body: WorkspaceCloneRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/workspaces/${encodeURIComponent(p.workspaceId)}/clone`, body, { signal }),
        addAsset: (p: WorkspaceIdParam, body: WorkspaceAssetAddRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/workspaces/${encodeURIComponent(p.workspaceId)}/assets`, body, { signal }),
        removeAsset: (p: WorkspaceIdParam & { assetId: string; }, signal?: AbortSignal) =>
            client.delete<unknown>(`/rest/workspaces/${encodeURIComponent(p.workspaceId)}/assets/${encodeURIComponent(p.assetId)}`, { signal }),
        addConversation: (p: WorkspaceIdParam, body: WorkspaceConversationAddRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/workspaces/${encodeURIComponent(p.workspaceId)}/conversations`, body, { signal }),
        removeConversation: (p: WorkspaceIdParam & { conversationId: string; }, signal?: AbortSignal) =>
            client.delete<unknown>(`/rest/workspaces/${encodeURIComponent(p.workspaceId)}/conversations/${encodeURIComponent(p.conversationId)}`, { signal }),
        grantPublic: (p: WorkspaceIdParam, body: WorkspacePublicPermissionRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/workspaces/${encodeURIComponent(p.workspaceId)}/permissions/public`, body, { signal }),
        grantEmail: (p: WorkspaceIdParam, body: WorkspaceEmailPermissionRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/rest/workspaces/${encodeURIComponent(p.workspaceId)}/permissions/email`, body, { signal })
    } as const;

    const systemPrompts = {
        create: (body: SystemPromptCreateRequest, signal?: AbortSignal) => client.post<unknown>("/rest/system-prompt/create", body, { signal }),
        get: (p: SystemPromptIdParam, signal?: AbortSignal) => client.get<unknown>(`/rest/system-prompt/${encodeURIComponent(p.systemPromptId)}`, { signal }),
        update: (p: SystemPromptIdParam, body: SystemPromptUpdateRequest, signal?: AbortSignal) =>
            client.put<unknown>(`/rest/system-prompt/${encodeURIComponent(p.systemPromptId)}`, body, { signal }),
        delete: (p: SystemPromptIdParam, signal?: AbortSignal) => client.delete<unknown>(`/rest/system-prompt/${encodeURIComponent(p.systemPromptId)}`, { signal }),
        list: (body: SystemPromptListRequest, signal?: AbortSignal) => client.post<unknown>("/rest/system-prompt/list", body, { signal })
    } as const;

    const livekit = {
        tokens: (body: LivekitTokensRequest, signal?: AbortSignal) => client.post<unknown>("/rest/livekit/tokens", body, { signal })
    } as const;

    const rateLimits = {
        getLegacy: (q: RateLimitRequest, signal?: AbortSignal) =>
            client.get<RateLimitData>("/rate_limits", { signal, query: { requestKind: q.requestKind, modelName: q.modelName } }),
        post: (body: RateLimitsPostRequest, signal?: AbortSignal) => client.post<RateLimitData>("/rest/rate-limits", body, { signal })
    } as const;

    const authMgmt = {
        teams: (signal?: AbortSignal) => client.get<TeamsListResponse>("/auth/teams", { signal }),
        team: (p: TeamIdParam, q: { returnCreateUser?: boolean; } = {}, signal?: AbortSignal) =>
            client.get<TeamAndRoleGetResponse>(`/auth/teams/${encodeURIComponent(p.teamId)}`, { signal, query: q }),
        teamAndRole: (p: TeamIdParam, q: { returnCreateUser?: boolean; } = {}, signal?: AbortSignal) =>
            client.get<TeamAndRoleGetResponse>(`/auth/team-and-role/${encodeURIComponent(p.teamId)}`, { signal, query: q }),
        listApiKeys: (p: TeamIdParam, q: TeamApiKeysQuery = {}, signal?: AbortSignal) =>
            client.get<unknown>(`/auth/teams/${encodeURIComponent(p.teamId)}/api-keys`, { signal, query: q }),
        createApiKey: (p: TeamIdParam, body: CreateApiKeyRequest, signal?: AbortSignal) =>
            client.post<unknown>(`/auth/teams/${encodeURIComponent(p.teamId)}/api-keys`, body, { signal }),
        updateApiKey: (p: ApiKeyIdParam, body: UpdateApiKeyRequest, signal?: AbortSignal) =>
            client.put<unknown>(`/auth/api-keys/${encodeURIComponent(p.apiKeyId)}`, body, { signal }),
        deleteApiKey: (p: ApiKeyIdParam, signal?: AbortSignal) => client.delete<unknown>(`/auth/api-keys/${encodeURIComponent(p.apiKeyId)}`, { signal }),
        apiKeyPropagation: (p: ApiKeyIdParam, signal?: AbortSignal) =>
            client.get<unknown>(`/auth/api-keys/${encodeURIComponent(p.apiKeyId)}/propagation`, { signal }),
        teamModels: (p: TeamIdParam, signal?: AbortSignal) => client.get<unknown>(`/auth/teams/${encodeURIComponent(p.teamId)}/models`, { signal }),
        teamEndpoints: (p: TeamIdParam, signal?: AbortSignal) => client.get<unknown>(`/auth/teams/${encodeURIComponent(p.teamId)}/endpoints`, { signal })
    } as const;

    const finance = {
        summary: (p: FinanceTickerParam, signal?: AbortSignal) => client.get<unknown>(`/rest/finance/${encodeURIComponent(p.ticker)}/summary`, { signal }),
        miniSummary: (p: FinanceTickerParam, signal?: AbortSignal) => client.get<unknown>(`/rest/finance/${encodeURIComponent(p.ticker)}/mini_summary`, { signal }),
        chart: (p: FinanceTickerParam & FinanceTimespanParam, signal?: AbortSignal) =>
            client.get<unknown>(`/rest/finance/${encodeURIComponent(p.ticker)}/chart/${encodeURIComponent(p.timespan)}`, { signal }),
        financials: (p: FinanceTickerParam & FinanceTimeframeParam, signal?: AbortSignal) =>
            client.get<unknown>(`/rest/finance/${encodeURIComponent(p.ticker)}/financials/${encodeURIComponent(p.timeframe)}`, { signal }),
        relatedTickers: (p: FinanceTickerParam, signal?: AbortSignal) =>
            client.get<unknown>(`/rest/finance/${encodeURIComponent(p.ticker)}/related_tickers`, { signal })
    } as const;

    const explore = {
        items: (body: ExploreItemsRequest, signal?: AbortSignal) => client.post<unknown>("/rest/explore/items", body, { signal }),
        item: (p: ExploreItemIdParam, signal?: AbortSignal) => client.get<unknown>(`/rest/explore/items/${encodeURIComponent(p.id)}`, { signal }),
        types: (q: ExploreTypesQuery = {}, signal?: AbortSignal) => client.get<unknown>("/rest/explore/types", { signal, query: q })
    } as const;

    const logging = {
        logMetric: (body: LogMetricRequest, signal?: AbortSignal) => client.post<unknown>("/api/log_metric", body, { signal }),
        verifyTurnstile: (body: VerifyTurnstileRequest, signal?: AbortSignal) => client.post<unknown>("/api/verify-turnstile", body, { signal })
    } as const;

    const users = {
        me: (signal?: AbortSignal) => client.get<UserProfile>("/users/me", { signal }),
        authUser: (signal?: AbortSignal) => auth.getUser(signal)
    } as const;

    const legacy = {
        models: {
            list: (signal?: AbortSignal) => client.get<ModelsResponse>("/models", { signal })
        },
        subscriptions: {
            get: (signal?: AbortSignal) => client.get<SubscriptionsResponse>("/subscriptions", { signal })
        }
    } as const;

    return {
        settings,
        chat,
        tasks,
        auth,
        subscriptions,
        models,
        assets,
        workspaces,
        systemPrompts,
        livekit,
        rateLimits,
        authMgmt,
        finance,
        explore,
        logging,
        users,
        legacy
    } as const;
};
