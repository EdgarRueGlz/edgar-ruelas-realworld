import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ArticlePreview } from "../components/ArticlePreview";
import { ErrorMessages } from "../components/ErrorMessages";
import { Pagination } from "../components/Pagination";
import type { ApiErrors, Article, ArticleList } from "../types";

const PAGE_SIZE = 10;

export function HomePage() {
  const { tag } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { user, state } = useAuth();
  const followingFeed = search.get("feed") === "following";
  const page = Math.max(1, Number.parseInt(search.get("page") ?? "1", 10) || 1);
  const [result, setResult] = useState<ArticleList>({ articles: [], articlesCount: 0 });
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<ApiErrors | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setErrors(null);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const articles = followingFeed
        ? await api.feed(PAGE_SIZE, offset)
        : await api.articles(new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
          ...(tag ? { tag } : {})
        }));
      setResult(articles);
    } catch (error) {
      setErrors(error instanceof ApiError ? error.errors : { request: ["Could not load articles."] });
    } finally {
      setLoading(false);
    }
  }, [followingFeed, page, tag]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrors(null);
    const offset = (page - 1) * PAGE_SIZE;
    const load = followingFeed
      ? api.feed(PAGE_SIZE, offset)
      : api.articles(new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        ...(tag ? { tag } : {})
      }));
    load.then((articles) => {
      if (active) setResult(articles);
    }).catch((error: unknown) => {
      if (active) setErrors(error instanceof ApiError ? error.errors : { request: ["Could not load articles."] });
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [followingFeed, page, tag]);

  useEffect(() => {
    let active = true;
    api.tags().then(({ tags: articleTags }) => {
      if (active) setTags(articleTags);
    }).catch(() => {
      if (active) setTags([]);
    });
    return () => { active = false; };
  }, [location.key]);

  const toggleFavorite = async (article: Article) => {
    if (!user) {
      navigate("/login", { state: { from: location.pathname + location.search } });
      return;
    }
    setBusySlug(article.slug);
    setErrors(null);
    try {
      await api.favorite(article.slug, !article.favorited);
      await loadArticles();
    } catch (error) {
      setErrors(error instanceof ApiError ? error.errors : { request: ["Could not update favorite."] });
    } finally {
      setBusySlug(null);
    }
  };

  if (followingFeed && state === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return (
    <>
      {!tag && (
        <section className="banner">
          <div className="container">
            <h1>conduit</h1>
            <p>A place to share your knowledge.</p>
          </div>
        </section>
      )}
      <div className="container page-grid">
        <section className="feed-column" aria-label="Article feed">
          <div className="feed-toggle">
            {user && (
              <Link className={`nav-link ${followingFeed ? "active" : ""}`} to="/?feed=following">Your Feed</Link>
            )}
            <Link className={`nav-link ${!followingFeed && !tag ? "active" : ""}`} to="/">Global Feed</Link>
            {tag && <span className="nav-link active"># {tag}</span>}
          </div>
          <ErrorMessages errors={errors} />
          {loading ? <p className="loading-state" role="status">Loading articles…</p> : result.articles.length === 0 ? (
            <div className="empty-feed-message" role="status">
              {followingFeed ? (
                <>Your feed is empty. <Link to="/">Global Feed</Link> has plenty of articles.</>
              ) : "No articles here... yet."}
            </div>
          ) : (
            <>
              {result.articles.map((article) => (
                <ArticlePreview key={article.slug} article={article} onFavorite={toggleFavorite} busy={busySlug === article.slug} />
              ))}
              <Pagination
                total={result.articlesCount}
                limit={PAGE_SIZE}
                page={page}
                href={(nextPage) => {
                  const params = new URLSearchParams(search);
                  if (nextPage === 1) params.delete("page");
                  else params.set("page", String(nextPage));
                  return `${location.pathname}${params.size ? `?${params}` : ""}`;
                }}
              />
            </>
          )}
        </section>
        <aside className="sidebar">
          <h2>Popular Tags</h2>
          {tags.length ? (
            <div className="tag-list">
              {tags.map((item) => <Link className="tag-default tag-pill" key={item} to={`/tag/${encodeURIComponent(item)}`}>{item}</Link>)}
            </div>
          ) : <p className="muted">No tags yet.</p>}
        </aside>
      </div>
    </>
  );
}
