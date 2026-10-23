import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/Avatar";
import { ErrorMessages } from "../components/ErrorMessages";
import type { ApiErrors, Article, Comment } from "../types";

export function ArticlePage() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [errors, setErrors] = useState<ApiErrors | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.article(slug), api.comments(slug)]).then(([articleResult, commentResult]) => {
      if (!active) return;
      setArticle(articleResult.article);
      setComments(commentResult.comments);
      setErrors(null);
    }).catch((error: unknown) => {
      if (active) setErrors(error instanceof ApiError ? error.errors : { request: ["Could not load this article."] });
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [slug]);

  const toggleFavorite = async () => {
    if (!article) return;
    if (!user) {
      navigate("/login", { state: { from: `/article/${encodeURIComponent(slug)}` } });
      return;
    }
    setErrors(null);
    try {
      const result = await api.favorite(slug, !article.favorited);
      setArticle(result.article);
    } catch (error) {
      setErrors(error instanceof ApiError ? error.errors : { request: ["Could not update favorite."] });
    }
  };

  const toggleFollow = async () => {
    if (!article) return;
    if (!user) {
      navigate("/login", { state: { from: `/article/${encodeURIComponent(slug)}` } });
      return;
    }
    try {
      const result = await api.follow(article.author.username, !article.author.following);
      setArticle({ ...article, author: result.profile });
    } catch (error) {
      setErrors(error instanceof ApiError ? error.errors : { request: ["Could not update follow status."] });
    }
  };

  const postComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      navigate("/login", { state: { from: `/article/${encodeURIComponent(slug)}` } });
      return;
    }
    setSubmitting(true);
    setErrors(null);
    try {
      const result = await api.addComment(slug, commentBody);
      setComments((current) => [...current, result.comment]);
      setCommentBody("");
    } catch (error) {
      setErrors(error instanceof ApiError ? error.errors : { request: ["Could not post comment."] });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId: number) => {
    setErrors(null);
    try {
      await api.deleteComment(slug, commentId);
      setComments((current) => current.filter((comment) => comment.id !== commentId));
    } catch (error) {
      setErrors(error instanceof ApiError ? error.errors : { request: ["Could not delete comment."] });
    }
  };

  const deleteArticle = async () => {
    setErrors(null);
    try {
      await api.deleteArticle(slug);
      navigate("/", { replace: true });
    } catch (error) {
      setErrors(error instanceof ApiError ? error.errors : { request: ["Could not delete article."] });
    }
  };

  if (loading) return <p className="container loading-state" role="status">Loading article…</p>;
  if (!article) {
    return <div className="container article-not-found"><ErrorMessages errors={errors} /><Link to="/">Return to home</Link></div>;
  }

  const isAuthor = user?.username === article.author.username;
  const date = new Date(article.createdAt);
  return (
    <div className="article-page">
      <header className="article-hero">
        <div className="container">
          <h1>{article.title}</h1>
          <div className="article-meta article-hero-meta">
            <Link to={`/profile/${encodeURIComponent(article.author.username)}`} className="avatar-link">
              <Avatar image={article.author.image} username={article.author.username} />
            </Link>
            <div className="article-author">
              <Link className="author" to={`/profile/${encodeURIComponent(article.author.username)}`}>{article.author.username}</Link>
              <time dateTime={article.createdAt}>{Number.isNaN(date.valueOf()) ? "" : date.toLocaleDateString()}</time>
            </div>
            {isAuthor ? (
              <>
                <Link className="btn btn-outline-secondary" to={`/editor/${encodeURIComponent(article.slug)}`}>Edit Article</Link>
                <button className="btn btn-outline-danger" type="button" onClick={deleteArticle}>Delete Article</button>
              </>
            ) : (
              <>
                <button className="btn btn-outline-secondary" type="button" onClick={toggleFollow}>
                  {article.author.following ? "Unfollow" : "Follow"} {article.author.username}
                </button>
                <button className={`btn ${article.favorited ? "btn-primary" : "btn-outline-primary"}`} type="button" onClick={toggleFavorite}>
                  {article.favorited ? "Unfavorite" : "Favorite"} Article ({article.favoritesCount})
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="container article-content">
        <ErrorMessages errors={errors} />
        <p className="article-markdown">{article.body}</p>
        {article.tagList.length > 0 && (
          <div className="tag-list article-tags" aria-label="Article tags">
            {article.tagList.map((tag) => <Link className="tag-default tag-pill" key={tag} to={`/tag/${encodeURIComponent(tag)}`}>{tag}</Link>)}
          </div>
        )}
        <hr />
        <div className="article-bottom-meta">
          <Avatar image={article.author.image} username={article.author.username} />
          <Link className="author" to={`/profile/${encodeURIComponent(article.author.username)}`}>{article.author.username}</Link>
          <span className="muted">{Number.isNaN(date.valueOf()) ? "" : date.toLocaleDateString()}</span>
        </div>
      </main>
      <section className="container comment-section" aria-label="Comments">
        <div className="comment-column">
          {user ? (
            <form className="card comment-form" onSubmit={postComment}>
              <div className="card-block">
                <label className="visually-hidden" htmlFor="comment-body">Write a comment</label>
                <textarea
                  id="comment-body"
                  name="body"
                  placeholder="Write a comment..."
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  required
                  rows={3}
                />
              </div>
              <div className="card-footer">
                <Avatar className="comment-author-img" image={user.image} username={user.username} />
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? "Posting…" : "Post Comment"}
                </button>
              </div>
            </form>
          ) : (
            <p className="comment-login-prompt">Sign in or sign up to add comments using the navigation above.</p>
          )}
          <ErrorMessages errors={errors} />
          {comments.map((comment) => (
            <article className="card" key={comment.id}>
              <div className="card-block"><p className="comment-body">{comment.body}</p></div>
              <div className="card-footer">
                <Link className="comment-author" to={`/profile/${encodeURIComponent(comment.author.username)}`}>
                  <Avatar className="comment-author-img" image={comment.author.image} username={comment.author.username} />
                  {comment.author.username}
                </Link>
                <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString()}</time>
                {user?.username === comment.author.username && (
                  <span className="mod-options">
                    <button className="icon-button" type="button" onClick={() => deleteComment(comment.id)} aria-label="Delete comment">
                      <i className="ion-trash-a" aria-hidden="true">×</i>
                    </button>
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
