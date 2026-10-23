export interface User {
  username: string;
  email: string;
  token: string;
  bio: string | null;
  image: string | null;
}

export interface Profile {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  body?: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: Profile;
}

export interface Comment {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: Profile;
}

export interface ArticleList {
  articles: Article[];
  articlesCount: number;
}

export type ApiErrors = Record<string, string[]>;

export interface AuthDebug {
  getToken(): string | null;
  getAuthState(): "authenticated" | "unauthenticated" | "unavailable" | "loading";
  getCurrentUser(): User | null;
}

declare global {
  interface Window {
    __conduit_debug__?: AuthDebug;
  }
}
