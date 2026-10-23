import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ErrorMessages } from "../components/ErrorMessages";
import type { ApiErrors } from "../types";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<ApiErrors | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors(null);
    try {
      const response = registering
        ? await api.register({ username, email, password })
        : await api.login({ email, password });
      signIn(response.user);
      const from = (location.state as { from?: unknown } | null)?.from;
      navigate(typeof from === "string" && from.startsWith("/") ? from : "/", { replace: true });
    } catch (error) {
      setErrors(error instanceof ApiError ? error.errors : { request: ["Could not complete the request."] });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page container narrow-container">
      <h1>{registering ? "Sign up" : "Sign in"}</h1>
      <p className="auth-switch">
        <Link to={registering ? "/login" : "/register"}>{registering ? "Have an account?" : "Need an account?"}</Link>
      </p>
      <ErrorMessages errors={errors} />
      <form onSubmit={handleSubmit} noValidate>
        {registering && (
          <label className="visually-hidden" htmlFor="register-username">Username</label>
        )}
        {registering && (
          <input id="register-username" name="username" autoComplete="username" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        )}
        <label className="visually-hidden" htmlFor={`${mode}-email`}>Email</label>
        <input id={`${mode}-email`} name="email" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label className="visually-hidden" htmlFor={`${mode}-password`}>Password</label>
        <input id={`${mode}-password`} name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button className="btn btn-primary submit-button" type="submit" disabled={submitting}>
          {submitting ? "Please wait…" : registering ? "Sign up" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
