import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/Avatar";
import { ErrorMessages } from "../components/ErrorMessages";
import type { ApiErrors } from "../types";

export function SettingsPage() {
  const { user, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [image, setImage] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<ApiErrors | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setImage(user.image ?? "");
    setUsername(user.username);
    setBio(user.bio ?? "");
    setEmail(user.email);
  }, [user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setErrors(null);
    const changes: Record<string, unknown> = { image, username, bio, email };
    if (password) changes.password = password;
    try {
      const result = await api.updateUser(changes);
      signIn(result.user);
      setPassword("");
      navigate(`/profile/${encodeURIComponent(result.user.username)}`);
    } catch (error) {
      setErrors(error instanceof ApiError ? error.errors : { request: ["Could not update settings."] });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container narrow-container settings-page">
      <h1>Your Settings</h1>
      <div className="settings-avatar"><Avatar className="user-img" image={image} username={username || user?.username || "user"} /></div>
      <ErrorMessages errors={errors} />
      <form onSubmit={handleSubmit} noValidate>
        <label className="visually-hidden" htmlFor="settings-image">URL of profile picture</label>
        <input id="settings-image" name="image" type="url" placeholder="URL of profile picture" value={image} onChange={(event) => setImage(event.target.value)} />
        <label className="visually-hidden" htmlFor="settings-username">Username</label>
        <input id="settings-username" name="username" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        <label className="visually-hidden" htmlFor="settings-bio">Short bio about you</label>
        <textarea id="settings-bio" name="bio" rows={5} placeholder="Short bio about you" value={bio} onChange={(event) => setBio(event.target.value)} />
        <label className="visually-hidden" htmlFor="settings-email">Email</label>
        <input id="settings-email" name="email" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label className="visually-hidden" htmlFor="settings-password">New Password</label>
        <input id="settings-password" name="password" type="password" autoComplete="new-password" placeholder="New Password (leave blank to keep current)" value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="btn btn-primary submit-button" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Update Settings"}
        </button>
      </form>
      <hr />
      <button
        className="btn btn-outline-danger logout-button"
        type="button"
        onClick={() => {
          signOut();
          navigate("/", { replace: true });
        }}
      >Or click here to logout</button>
      <p className="settings-back"><Link to="/">Back to home</Link></p>
    </div>
  );
}
