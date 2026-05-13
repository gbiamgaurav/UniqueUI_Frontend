import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

export default function AuthCallback() {
  const nav = useNavigate();
  const { setUserAndToken } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const sessionId = params.get("session_id");
    if (!sessionId) {
      nav("/login");
      return;
    }

    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", null, {
          headers: { "X-Session-ID": sessionId },
        });
        setUserAndToken(data.user, data.access_token);
        // Clean hash
        window.history.replaceState(null, "", window.location.pathname);
        nav("/dashboard", { state: { user: data.user }, replace: true });
      } catch (e) {
        toast.error("Google sign-in failed");
        nav("/login", { replace: true });
      }
    })();
  }, [nav, setUserAndToken]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="label-tag" data-testid="oauth-processing">Establishing session…</div>
    </div>
  );
}
