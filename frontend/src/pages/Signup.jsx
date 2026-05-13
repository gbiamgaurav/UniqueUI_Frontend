import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { toast } from "sonner";
import { Sun, Moon } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function startGoogleOAuth() {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

export default function Signup() {
  const { signup } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signup(email, password, name);
      toast.success("Account created");
      nav("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-10 border-r border-[var(--border)] bg-[var(--surface)]">
        <Link to="/" className="flex items-center gap-3" data-testid="signup-brand">
          <span className="dot"/>
          <span className="font-display text-2xl">Lexicon</span>
        </Link>
        <div>
          <h2 className="font-display text-5xl leading-tight">Create an<br/>archive of<br/>conversations.</h2>
          <p className="mt-4 label-tag">— begin your edition</p>
        </div>
        <div className="label-tag">Plate 03 · Subscribe</div>
      </div>

      <div className="flex flex-col">
        <div className="flex justify-end p-6">
          <button onClick={toggle} className="btn-ghost !p-2" data-testid="theme-toggle">
            {theme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <form onSubmit={submit} className="w-full max-w-md" data-testid="signup-form">
            <span className="label-tag">Begin</span>
            <h1 className="font-display text-4xl mt-2">Create account</h1>

            <button type="button" onClick={startGoogleOAuth} className="btn-ghost w-full mt-8 inline-flex items-center justify-center gap-3" data-testid="oauth-google">
              <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.2 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.2 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.4-4.6 2.3-7.3 2.3-5.2 0-9.6-3.6-11.2-8.4l-6.5 5C9.4 39.6 16.1 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.2 5.2C40.6 35.5 44 30.2 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1 bg-[var(--border)]"/>
              <span className="label-tag">or</span>
              <div className="h-px flex-1 bg-[var(--border)]"/>
            </div>

            <label className="label-tag">Name</label>
            <input className="input-field mt-1" required value={name} onChange={(e) => setName(e.target.value)} data-testid="signup-name"/>

            <label className="label-tag mt-4 block">Email</label>
            <input className="input-field mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="signup-email"/>

            <label className="label-tag mt-4 block">Password</label>
            <input className="input-field mt-1" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} data-testid="signup-password"/>

            <button type="submit" disabled={busy} className="btn-primary w-full mt-6" data-testid="signup-submit">
              {busy ? "Creating…" : "Create account"}
            </button>

            <p className="mt-6 text-xs text-[var(--text-sub)]">
              Already registered? <Link to="/login" className="underline" data-testid="goto-login">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
