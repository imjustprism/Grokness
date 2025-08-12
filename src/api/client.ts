/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    type ApiConfig,
    ApiError,
    type HeadersInitLike,
    type HttpMethod,
    type JsonValue,
    type QueryParams,
    type RequestInitExt,
    type RequestOptions,
    type RetryPolicy
} from "@api/types";

const dfltRetry: RetryPolicy = { retries: 3, baseDelayMs: 200, maxDelayMs: 5000, retryOn: [408, 425, 429, 500, 502, 503, 504] };

const isJsonContent = (h: Headers): boolean => {
    const v = h.get("content-type");
    return !!v && /(^|\+|\/)json\b/i.test(v);
};

const toRecord = (h: Headers): Record<string, string> => {
    const obj: Record<string, string> = {};
    h.forEach((val, key) => {
        obj[key] = val;
    });
    return obj;
};

const hasMessage = (x: unknown): x is { message: string; } => typeof x === "object" && x !== null && "message" in x && typeof (x as { message: unknown; }).message === "string";

const readCookie = (name: string, src: string | undefined = typeof document !== "undefined" ? document.cookie : undefined): string | null => {
    if (!src) {
        return null;
    }
    const parts = src.split(";").map(x => x.trim());
    for (const p of parts) {
        if (!p) {
            continue;
        }
        const eq = p.indexOf("=");
        if (eq === -1) {
            continue;
        }
        const k = decodeURIComponent(p.slice(0, eq));
        if (k === name) {
            return decodeURIComponent(p.slice(eq + 1));
        }
    }
    return null;
};

const defaultDomCsrfProvider = (): string | null => {
    if (typeof document === "undefined") {
        return null;
    }
    const metaSelectors = ['meta[name="csrf-token"]', 'meta[name="x-csrf-token"]', 'meta[name="xsrf-token"]', 'meta[name="X-CSRF-Token"]'];
    for (const sel of metaSelectors) {
        const el = document.querySelector(sel) as HTMLMetaElement | null;
        if (el?.content) {
            return el.content;
        }
    }
    const cookieNames = ["XSRF-TOKEN", "csrfToken", "csrf-token", "g_csrf", "x_csrf_token", "xsrf-token"];
    for (const n of cookieNames) {
        const v = readCookie(n);
        if (v) {
            return v;
        }
    }
    return null;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const jitter = (n: number) => Math.floor(n * (0.5 + Math.random() * 0.5));

type ETagEntry = { etag: string; body: unknown; };
type InflightEntry<T> = Promise<T>;

/**
 * Strongly-typed HTTP client with retries, optional ETag cache, timeouts and CSRF support.
 */
export class ApiClient {
    readonly baseUrl: string;
    readonly includeCredentials: boolean;
    readonly defaultHeaders: HeadersInitLike;
    readonly csrfEnabled: boolean;
    readonly csrfHeaderName: string;
    readonly csrfProvider: (() => Promise<string | null>) | (() => string | null);
    readonly fetchImpl: typeof fetch;
    readonly retry: RetryPolicy;
    readonly defaultTimeoutMs: number;

    private readonly etagCache: Map<string, ETagEntry>;
    private readonly ttlCache: Map<string, { body: unknown; expiresAt: number; }>;
    private readonly inflight: Map<string, InflightEntry<unknown>>;
    private readonly cacheEtag: boolean;
    private readonly cacheMax: number;

    constructor(cfg: ApiConfig) {
        this.baseUrl = cfg.baseUrl.replace(/\/$/, "");
        this.includeCredentials = cfg.includeCredentials ?? true;
        this.defaultHeaders = { accept: "application/json", ...(cfg.defaultHeaders ?? {}) };
        this.csrfEnabled = !!cfg.csrf?.enabled;
        this.csrfHeaderName = cfg.csrf?.headerName ?? "X-CSRF-Token";
        const csrfProv = cfg.csrf?.getToken ?? defaultDomCsrfProvider;
        this.csrfProvider = async () => Promise.resolve(csrfProv());
        const baseFetch = cfg.fetchImpl ?? globalThis.fetch;
        this.fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => baseFetch(input, init)) as typeof fetch;
        this.retry = { ...dfltRetry, ...(cfg.retry ?? {}) };
        this.defaultTimeoutMs = Math.max(0, cfg.timeoutMs ?? 0);
        this.cacheEtag = !!cfg.cache?.etag;
        this.cacheMax = Math.max(0, cfg.cache?.maxEntries ?? 200);
        this.etagCache = new Map();
        this.ttlCache = new Map();
        this.inflight = new Map();
    }

    /**
     * Build an absolute URL for a given path and query parameters.
     * @param path - Absolute or relative path
     * @param query - Optional query parameters
     * @returns Fully qualified URL
     */
    url(path: string, query?: QueryParams): string {
        const u = new URL(path.startsWith("http") ? path : this.baseUrl + (path.startsWith("/") ? path : "/" + path));
        if (query) {
            for (const [k, v] of Object.entries(query)) {
                if (v === null || v === undefined) {
                    continue;
                }
                if (Array.isArray(v)) {
                    for (const x of v) {
                        u.searchParams.append(k, String(x));
                    }
                } else {
                    u.searchParams.append(k, String(v));
                }
            }
        }
        return u.toString();
    }

    private cacheKey(method: HttpMethod, url: string, body?: unknown): string {
        if (method !== "GET") {
            return `${method}:${url}:${typeof body === "string" ? body : ""}`;
        }
        return `${method}:${url}`;
    }

    private touchCache(key: string, etag: string, body: unknown): void {
        if (!this.cacheEtag) {
            return;
        }
        if (this.etagCache.size >= this.cacheMax) {
            const first = this.etagCache.keys().next().value as string | undefined;
            if (first) {
                this.etagCache.delete(first);
            }
        }
        this.etagCache.set(key, { etag, body });
    }

    /**
     * Execute an HTTP request and parse the response as JSON/text accordingly.
     * @param method - HTTP method
     * @param path - Path relative to baseUrl (or absolute)
     * @param init - Additional RequestInit
     * @param opts - Per-request options
     * @returns Parsed response body
     */
    async request<T = unknown>(method: HttpMethod, path: string, init?: RequestInitExt, opts?: RequestOptions): Promise<T> {
        const signal = opts?.signal ?? init?.signal;
        const url = this.url(path, opts?.query);
        const cacheKey = opts?.cacheKey ?? this.cacheKey(method, url, init?.body);
        const headers: HeadersInitLike = { ...this.defaultHeaders, ...(init?.headers ?? {}), ...(opts?.headers ?? {}) };
        if (this.csrfEnabled && method !== "GET" && method !== "HEAD") {
            const token = await this.csrfProvider();
            if (token) {
                headers[this.csrfHeaderName] = token;
            }
        }
        const useEtag = this.cacheEtag && method === "GET";
        const useTtl = method === "GET" && this.cacheMax > 0 && typeof globalThis !== "undefined";
        const cached = useEtag ? this.etagCache.get(cacheKey) : undefined;

        if (useTtl && !opts?.bypassTtl) {
            const ttlMs = (this as unknown as { cache?: { ttlMs?: number; staleWhileRevalidate?: boolean; }; }).cache?.ttlMs ?? 0;
            const swr = (this as unknown as { cache?: { ttlMs?: number; staleWhileRevalidate?: boolean; }; }).cache?.staleWhileRevalidate ?? false;
            const entry = this.ttlCache.get(cacheKey);
            const now = Date.now();
            if (ttlMs > 0 && entry) {
                if (entry.expiresAt > now) {
                    return entry.body as T;
                }
                if (swr) {
                    this.executeWithRetry(() => attemptRequest().then(res => {
                        this.ttlCache.set(cacheKey, { body: res, expiresAt: now + ttlMs });
                        return res;
                    })).catch(() => void 0);
                    return entry.body as T;
                }
            }
        }
        if (useEtag && cached?.etag) {
            headers["If-None-Match"] = cached.etag;
        }

        const attemptRequest = async (): Promise<T> => {
            const res = await this.fetchImpl(url, {
                method,
                signal,
                credentials: this.includeCredentials ? "include" : "same-origin",
                headers,
                body: init?.body
            });

            if (!res.ok) {
                if (this.retry.retryOn.includes(res.status)) {
                    throw res;
                }
                let body: JsonValue | null = null;
                try {
                    body = isJsonContent(res.headers) ? ((await res.json()) as JsonValue) : ((await res.text()) as JsonValue);
                } catch {
                    body = null;
                }
                const msg = hasMessage(body) ? body.message : res.statusText || "Request failed";
                throw new ApiError<JsonValue>({ status: res.status, method, url, message: msg, body, headers: toRecord(res.headers) });
            }

            if (res.status === 304 && cached) {
                return cached.body as T;
            }
            if (res.status === 204) {
                return undefined as unknown as T;
            }

            if (!isJsonContent(res.headers)) {
                const text = await res.text();
                const et = res.headers.get("etag");
                if (useEtag && et) {
                    this.touchCache(cacheKey, et, text);
                }
                return text as unknown as T;
            }

            const data = (await res.json()) as T;
            const et = res.headers.get("etag");
            if (useEtag && et) {
                this.touchCache(cacheKey, et, data);
            }

            const ttlMs = (this as unknown as { cache?: { ttlMs?: number; staleWhileRevalidate?: boolean; }; }).cache?.ttlMs ?? 0;
            if (method === "GET" && ttlMs > 0) {
                this.ttlCache.set(cacheKey, { body: data, expiresAt: Date.now() + ttlMs });
            }
            return data;
        };

        const inflightKey = method === "GET" ? cacheKey : "";
        if (inflightKey) {
            const existing = this.inflight.get(inflightKey) as InflightEntry<T> | undefined;
            if (existing) {
                return existing;
            }
        }

        const exec = this.executeWithRetry(async () => {
            if (!this.defaultTimeoutMs && !opts?.timeoutMs) {
                return attemptRequest();
            }
            const timeout = opts?.timeoutMs ?? this.defaultTimeoutMs;
            if (timeout <= 0) {
                return attemptRequest();
            }
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);
            try {
                return await attemptRequest();
            } finally {
                clearTimeout(timer);
            }
        });

        if (inflightKey) {
            this.inflight.set(inflightKey, exec as InflightEntry<unknown>);
        }

        try {
            const out = await exec;
            return out;
        } finally {
            if (inflightKey) {
                this.inflight.delete(inflightKey);
            }
        }
    }

    private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
        let attempt = 0;
        let delay = this.retry.baseDelayMs;
        for (; ;) {
            try {
                return await fn();
            } catch (err) {
                if (attempt >= this.retry.retries) {
                    throw err;
                }
                await sleep(jitter(delay));
                attempt++;
                delay = Math.min(this.retry.maxDelayMs, delay * 2);
            }
        }
    }

    get<T = unknown>(path: string, opts?: RequestOptions): Promise<T> {
        return this.request<T>("GET", path, undefined, opts);
    }

    post<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
        const init: RequestInitExt = { headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) };
        return this.request<T>("POST", path, init, opts);
    }

    put<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
        const init: RequestInitExt = { headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) };
        return this.request<T>("PUT", path, init, opts);
    }

    patch<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
        const init: RequestInitExt = { headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) };
        return this.request<T>("PATCH", path, init, opts);
    }

    delete<T = unknown>(path: string, opts?: RequestOptions): Promise<T> {
        return this.request<T>("DELETE", path, undefined, opts);
    }

    static fromWindow(cfg?: Partial<Omit<ApiConfig, "baseUrl">> & { basePath?: string; }): ApiClient {
        const origin = typeof window !== "undefined" && window.location ? window.location.origin : "";
        const basePath = cfg?.basePath ?? "";
        const baseUrl = origin + basePath;
        return new ApiClient({
            baseUrl,
            defaultHeaders: cfg?.defaultHeaders,
            includeCredentials: cfg?.includeCredentials ?? true,
            csrf: cfg?.csrf ?? { enabled: true, getToken: defaultDomCsrfProvider },
            cache: cfg?.cache,
            retry: cfg?.retry,
            fetchImpl: cfg?.fetchImpl
        });
    }
}
