import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();
  if (state === "loading") return <p className="container loading-state" role="status">Loading session…</p>;
  if (state !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}
