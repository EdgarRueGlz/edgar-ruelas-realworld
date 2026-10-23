import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { ArticlePage } from "./pages/ArticlePage";
import { AuthPage } from "./pages/AuthPage";
import { EditorPage } from "./pages/EditorPage";
import { HomePage } from "./pages/HomePage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="tag/:tag" element={<HomePage />} />
            <Route path="login" element={<AuthPage mode="login" />} />
            <Route path="register" element={<AuthPage mode="register" />} />
            <Route path="article/:slug" element={<ArticlePage />} />
            <Route path="profile/:username" element={<ProfilePage />} />
            <Route path="profile/:username/favorites" element={<ProfilePage />} />
            <Route element={<RequireAuth />}>
              <Route path="editor" element={<EditorPage />} />
              <Route path="editor/:slug" element={<EditorPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
