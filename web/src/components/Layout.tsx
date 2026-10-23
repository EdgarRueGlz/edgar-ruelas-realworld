import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "./Avatar";

export function Layout() {
  const { user, state, signOut } = useAuth();
  return (
    <>
      <nav className="navbar">
        <div className="container navbar-inner">
          <Link className="navbar-brand" to="/">conduit</Link>
          <div className="nav-items">
            <NavLink className="nav-link" to="/">Home</NavLink>
            {user ? (
              <>
                <NavLink className="nav-link" to="/editor">New Article</NavLink>
                <NavLink className="nav-link" to="/settings">Settings</NavLink>
                <NavLink className="nav-link profile-nav" to={`/profile/${encodeURIComponent(user.username)}`}>
                  <Avatar className="user-pic" image={user.image} username={user.username} />
                  {user.username}
                </NavLink>
                <button className="nav-link nav-button" type="button" onClick={signOut}>Sign out</button>
              </>
            ) : state === "loading" ? (
              <span className="nav-link muted" aria-live="polite">Loading session…</span>
            ) : (
              <>
                <NavLink className="nav-link" to="/login">Sign in</NavLink>
                <NavLink className="nav-link" to="/register">Sign up</NavLink>
              </>
            )}
          </div>
        </div>
      </nav>
      <main id="main-content"><Outlet /></main>
      <footer className="site-footer">
        <div className="container">
          <Link className="footer-brand" to="/">conduit</Link>
          <span>A place to share your knowledge.</span>
        </div>
      </footer>
    </>
  );
}
