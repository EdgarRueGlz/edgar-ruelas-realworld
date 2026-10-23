import type { ApiErrors } from "../types";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const tokenKey = "jwtToken";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: ApiErrors
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(tokenKey);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(tokenKey, token);
    else window.localStorage.removeItem(tokenKey);
  } catch {
    window.dispatchEvent(new CustomEvent("conduit:storage-unavailable"));
  }
}

async function request<T>(path: string, options: {
  method?: string;
  body?: unknown;
  authenticated?: boolean;
} = {}): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.authenticated !== false) {
    const token = getStoredToken();
    if (token) headers.set("Authorization", `Token ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method: options.method ?? "GET",
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
    });
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : "Could not connect to the API.",
      0,
      { network: ["Could not connect to the API. Check your connection and try again."] }
    );
  }

  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errors = isRecord(payload) && isRecord(payload.errors)
      ? payload.errors as ApiErrors
      : { request: [`Request failed (${response.status}).`] };
    if (response.status === 401 && getStoredToken()) {
      storeToken(null);
      window.dispatchEvent(new Event("conduit:auth-changed"));
    }
    throw new ApiError(Object.values(errors).flat().join(" "), response.status, errors);
  }
  return payload as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const api = {
  register: (user: { username: string; email: string; password: string }) =>
    request<{ user: import("../types").User }>("/users", { method: "POST", body: { user }, authenticated: false }),
  login: (user: { email: string; password: string }) =>
    request<{ user: import("../types").User }>("/users/login", { method: "POST", body: { user }, authenticated: false }),
  currentUser: () => request<{ user: import("../types").User }>("/user"),
  updateUser: (user: Record<string, unknown>) =>
    request<{ user: import("../types").User }>("/user", { method: "PUT", body: { user } }),
  profile: (username: string) =>
    request<{ profile: import("../types").Profile }>(`/profiles/${encodeURIComponent(username)}`),
  follow: (username: string, following: boolean) =>
    request<{ profile: import("../types").Profile }>(`/profiles/${encodeURIComponent(username)}/follow`, {
      method: following ? "POST" : "DELETE"
    }),
  articles: (params: URLSearchParams = new URLSearchParams()) =>
    request<import("../types").ArticleList>(`/articles${params.size ? `?${params}` : ""}`),
  feed: (limit: number, offset: number) =>
    request<import("../types").ArticleList>(`/articles/feed?limit=${limit}&offset=${offset}`),
  article: (slug: string) =>
    request<{ article: import("../types").Article }>(`/articles/${encodeURIComponent(slug)}`),
  createArticle: (article: { title: string; description: string; body: string; tagList: string[] }) =>
    request<{ article: import("../types").Article }>("/articles", { method: "POST", body: { article } }),
  updateArticle: (slug: string, article: Partial<{ title: string; description: string; body: string; tagList: string[] }>) =>
    request<{ article: import("../types").Article }>(`/articles/${encodeURIComponent(slug)}`, { method: "PUT", body: { article } }),
  deleteArticle: (slug: string) =>
    request<void>(`/articles/${encodeURIComponent(slug)}`, { method: "DELETE" }),
  favorite: (slug: string, favorited: boolean) =>
    request<{ article: import("../types").Article }>(`/articles/${encodeURIComponent(slug)}/favorite`, {
      method: favorited ? "POST" : "DELETE"
    }),
  comments: (slug: string) =>
    request<{ comments: import("../types").Comment[] }>(`/articles/${encodeURIComponent(slug)}/comments`),
  addComment: (slug: string, body: string) =>
    request<{ comment: import("../types").Comment }>(`/articles/${encodeURIComponent(slug)}/comments`, { method: "POST", body: { comment: { body } } }),
  deleteComment: (slug: string, id: number) =>
    request<void>(`/articles/${encodeURIComponent(slug)}/comments/${id}`, { method: "DELETE" }),
  tags: () => request<{ tags: string[] }>("/tags")
};

