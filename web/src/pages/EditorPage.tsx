import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { ErrorMessages } from "../components/ErrorMessages";
import type { ApiErrors } from "../types";

export function EditorPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(slug);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<ApiErrors | null>(null);
  const [loading, setLoading] = useState(editing);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    api.article(slug).then(({ article }) => {
      if (!active) return;
      setTitle(article.title);
      setDescription(article.description);
      setBody(article.body ?? "");
      setTags(article.tagList);
    }).catch((error: unknown) => {
      if (active) {
        setErrors(error instanceof ApiError ? error.errors : { request: ["Could not load article."] });
        setLoading(false);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [slug]);

  const addTags = (value: string) => {
    const added = value.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (added.length) setTags((current) => [...new Set([...current, ...added])]);
    setTagInput("");
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTags(tagInput);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors(null);
    try {
      const article = { title, description, body, tagList: tags };
      const result = editing && slug
        ? await api.updateArticle(slug, article)
        : await api.createArticle(article);
      navigate(`/article/${encodeURIComponent(result.article.slug)}`, { replace: true });
    } catch (error) {
      setErrors(error instanceof ApiError ? error.errors : { request: ["Could not save article."] });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="container loading-state" role="status">Loading article…</p>;
  return (
    <div className="container narrow-container editor-page">
      <h1>{editing ? "Edit article" : "New article"}</h1>
      <ErrorMessages errors={errors} />
      <form onSubmit={handleSubmit} noValidate>
        <label className="visually-hidden" htmlFor="article-title">Article title</label>
        <input id="article-title" name="title" placeholder="Article Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <label className="visually-hidden" htmlFor="article-description">What's this article about?</label>
        <input id="article-description" name="description" placeholder="What's this article about?" value={description} onChange={(event) => setDescription(event.target.value)} required />
        <label className="visually-hidden" htmlFor="article-body">Write your article</label>
        <textarea id="article-body" name="body" rows={10} placeholder="Write your article (in markdown)" value={body} onChange={(event) => setBody(event.target.value)} required />
        <label className="visually-hidden" htmlFor="article-tags">Tags</label>
        <input
          id="article-tags"
          placeholder="Enter tags"
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
          onKeyDown={handleTagKeyDown}
          onBlur={() => tagInput.trim() && addTags(tagInput)}
          aria-describedby="tag-help"
        />
        <span id="tag-help" className="muted">Press Enter or comma to add each tag.</span>
        {tags.length > 0 && (
          <div className="tag-list editor-tags" aria-label="Selected tags">
            {tags.map((tag) => (
              <button className="tag-default tag-pill tag-remove" key={tag} type="button" onClick={() => setTags((current) => current.filter((item) => item !== tag))}>
                {tag} <i aria-hidden="true">×</i><span className="visually-hidden"> Remove tag</span>
              </button>
            ))}
          </div>
        )}
        <button className="btn btn-primary submit-button" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Publish Article"}
        </button>
      </form>
    </div>
  );
}
