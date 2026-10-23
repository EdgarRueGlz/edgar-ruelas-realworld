import { Link } from "react-router-dom";
import type { Article } from "../types";
import { Avatar } from "./Avatar";

export function ArticlePreview({ article, onFavorite, busy = false }: {
  article: Article;
  onFavorite?: (article: Article) => void;
  busy?: boolean;
}) {
  const date = new Date(article.createdAt);
  return (
    <article className="article-preview">
      <div className="article-meta">
        <Link className="avatar-link" to={`/profile/${encodeURIComponent(article.author.username)}`}>
          <Avatar className="user-pic" image={article.author.image} username={article.author.username} />
        </Link>
        <div className="article-author">
          <Link className="author" to={`/profile/${encodeURIComponent(article.author.username)}`}>
            {article.author.username}
          </Link>
          <time dateTime={article.createdAt}>{Number.isNaN(date.valueOf()) ? "" : date.toLocaleDateString()}</time>
        </div>
        {onFavorite && (
          <button
            className={`favorite-button ${article.favorited ? "btn-primary" : "btn-outline-primary"}`}
            type="button"
            disabled={busy}
            onClick={() => onFavorite(article)}
            aria-label={`${article.favorited ? "Unfavorite" : "Favorite"} article by ${article.author.username}`}
          >
            <span aria-hidden="true">♥</span> {article.favoritesCount}
          </button>
        )}
      </div>
      <Link className="preview-link" to={`/article/${encodeURIComponent(article.slug)}`} reloadDocument>
        <div className="article-summary">
          <h1>{article.title}</h1>
          <p>{article.description}</p>
          <span className="read-more">Read more...</span>
          {article.tagList.length > 0 && (
            <div className="tag-list" aria-label="Article tags">
              {article.tagList.map((tag) => <span className="tag-default tag-pill" key={tag}>{tag}</span>)}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}
