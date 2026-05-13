import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft } from "lucide-react";

export default function ResponseDetail() {
  const { messageId } = useParams();
  const nav = useNavigate();
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/messages/${messageId}`);
        setMsg(data);
      } catch (e) {
        setErr(e?.response?.data?.detail || "Not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [messageId]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12" data-testid="response-detail-page">
      <button onClick={() => nav(-1)} className="btn-ghost inline-flex items-center gap-2 mb-8" data-testid="response-back">
        <ArrowLeft size={14}/> Back
      </button>

      {loading && <div className="label-tag">Loading…</div>}
      {err && <div className="text-[var(--error)] text-sm">{err}</div>}

      {msg && (
        <article>
          <span className="label-tag">{msg.role === "assistant" ? "Lexicon response" : "Your question"}</span>
          <h1 className="font-display text-4xl mt-2 tracking-tight">
            {new Date(msg.created_at).toLocaleString()}
          </h1>
          <hr className="my-8 border-[var(--border)]"/>
          <div className="chat-md leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>

          <div className="mt-12 label-tag">— End of plate</div>
          <Link to="/chat" className="btn-ghost mt-6 inline-block" data-testid="back-to-chat">Back to chat</Link>
        </article>
      )}
    </div>
  );
}
