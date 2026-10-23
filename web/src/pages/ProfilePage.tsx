import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/Avatar";
import { ArticlePreview } from "../components/ArticlePreview";
import { ErrorMessages } from "../components/ErrorMessages";
import { Pagination } from "../components/Pagination";
import type { ApiErrors, ArticleList, Profile } from "../types";

const PAGE_SIZE = 10;

export function ProfilePage() {
  const { username = "" } = useParams();
  const location = useLocation();
  const [search] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const favoritesTab = location.pathname.endsWith("/favorites");
  const page = Math.max(1, Number.parseInt(search.get("page") ?? "1", 10) || 1);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [articles, setArticles] = useState<ArticleList>({ articles: [], articlesCount: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<ApiErrors | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrors(null);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
      ...(favoritesTab ? { favorited: username } : { author: username })
    });
    Promise.all([api.profile(username), api.articles(params)]).then(([profileResult, list]) => {
      if (!active) return;
      setProfile(profileResult.profile);
      setArticles(list);
    }).catch((error: unknown) => {
      if (active) setErrors(error instanceof ApiError ? error.errors : { request: ["Could not load profile."] });
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [favoritesTab, page, username]);

  const toggleFollow = async () => {
    if (!profile) return;
    if (!user) {
      navigate("/login", { state: { from: `/profile/${encodeURIComponent(username)}` } });
      return;
    }
    setBusy(true);
    setErrors(null);
    try {
      const result = await api.follow(username, !profile.following);
      setProfile(result.profile);
    } catch (error) {
      setErrors(error instanceof ApiError ? error.errors : { request: ["Could not update follow status."] });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="container loading-state" role="status">Loading profile…</p>;
  if (!profile) return <div className="container"><ErrorMessages errors={errors} /></div>;
  const ownProfile = user?.username === profile.username;
  return (
    <div className="profile-page">
      <section className="user-info">
        <div className="container">
          <Avatar className="user-img" image={profile.image} username={profile.username} />
          <h4>{profile.username}</h4>
          <p>{profile.bio ?? ""}</p>
          {ownProfile ? (
            <Link className="btn btn-outline-secondary profile-action" to="/settings">Edit Profile Settings</Link>
          ) : (
            <button className="btn btn-outline-secondary profile-action" type="button" disabled={busy} onClick={toggleFollow}>
              {profile.following ? "Unfollow" : "Follow"} {profile.username}
            </button>
          )}
        </div>
      </section>
      <div className="container profile-content">
        <div className="feed-toggle">
          <Link className={`nav-link ${!favoritesTab ? "active" : ""}`} to={`/profile/${encodeURIComponent(username)}`}>My Articles</Link>
          <Link className={`nav-link ${favoritesTab ? "active" : ""}`} to={`/profile/${encodeURIComponent(username)}/favorites`}>Favorited</Link>
        </div>
        <ErrorMessages errors={errors} />
        {articles.articles.length === 0 ? (
          <div className="empty-feed-message" role="status">No articles here... yet.</div>
        ) : (
          <>
            {articles.articles.map((article) => <ArticlePreview key={article.slug} article={article} />)}
            <Pagination
              total={articles.articlesCount}
              limit={PAGE_SIZE}
              page={page}
              href={(nextPage) => {
                const params = new URLSearchParams(search);
                if (nextPage === 1) params.delete("page");
                else params.set("page", String(nextPage));
                const base = `/profile/${encodeURIComponent(username)}${favoritesTab ? "/favorites" : ""}`;
                return `${base}${params.size ? `?${params}` : ""}`;
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
