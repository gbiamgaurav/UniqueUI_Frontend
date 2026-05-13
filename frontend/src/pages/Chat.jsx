import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { Plus, Send, Trash2, ExternalLink, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Chat() {
  const { conversationId } = useParams();
  const nav = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentId, setCurrentId] = useState(conversationId || null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [useFiles, setUseFiles] = useState(true);
  const scrollerRef = useRef(null);

  const loadConversations = async () => {
    try {
      const { data } = await api.get("/conversations");
      setConversations(data);
    } catch (e) { /* noop */ }
  };

  const loadMessages = async (cid) => {
    if (!cid) { setMessages([]); return; }
    try {
      const { data } = await api.get(`/conversations/${cid}`);
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => {
    setCurrentId(conversationId || null);
    loadMessages(conversationId || null);
  }, [conversationId]);

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages]);

  const newChat = async () => {
    setCurrentId(null);
    setMessages([]);
    nav("/chat");
  };

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    // Optimistic user message
    const tempId = `tmp_${Date.now()}`;
    setMessages((m) => [
      ...m,
      { message_id: tempId, role: "user", content: text, created_at: new Date().toISOString() },
    ]);
    setInput("");
    try {
      const { data } = await api.post("/chat", {
        conversation_id: currentId,
        message: text,
        use_files: useFiles,
      });
      // Replace temp message with actual + assistant
      setMessages((m) => {
        const without = m.filter((x) => x.message_id !== tempId);
        return [...without, data.user_message, data.assistant_message];
      });
      if (!currentId) {
        setCurrentId(data.conversation_id);
        nav(`/chat/${data.conversation_id}`, { replace: true });
      }
      loadConversations();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Send failed");
      setMessages((m) => m.filter((x) => x.message_id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const removeConv = async (cid) => {
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await api.delete(`/conversations/${cid}`);
      if (cid === currentId) { setCurrentId(null); setMessages([]); nav("/chat"); }
      loadConversations();
    } catch { toast.error("Delete failed"); }
  };

  return (
    <div className="max-w-7xl mx-auto px-0 sm:px-6 h-[calc(100vh-4rem)] grid grid-cols-1 md:grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <aside className="border-r border-[var(--border)] bg-[var(--surface)] hidden md:flex md:flex-col">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <span className="label-tag">History</span>
          <button onClick={newChat} className="btn-ghost !p-2" data-testid="new-chat-button" title="New chat">
            <Plus size={14}/>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {conversations.length === 0 && (
            <div className="p-4 text-xs text-[var(--text-sub)]">No conversations yet.</div>
          )}
          {conversations.map((c) => (
            <div
              key={c.conversation_id}
              className={`px-4 py-3 border-b border-[var(--border)] flex items-start justify-between gap-2 cursor-pointer hover:bg-[color:var(--border)]/40 ${
                c.conversation_id === currentId ? "bg-[color:var(--border)]/40" : ""
              }`}
              onClick={() => nav(`/chat/${c.conversation_id}`)}
              data-testid="chat-history-item"
            >
              <div className="min-w-0">
                <div className="text-sm truncate">{c.title || "Untitled"}</div>
                <div className="label-tag mt-1">{c.message_count} msg · {new Date(c.updated_at).toLocaleDateString()}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); removeConv(c.conversation_id); }} className="text-[var(--text-sub)] hover:text-[var(--error)]" data-testid="chat-delete-btn">
                <Trash2 size={14}/>
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <section className="flex flex-col h-full" data-testid="chat-main">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="min-w-0">
            <span className="label-tag">Conversation</span>
            <h2 className="font-display text-2xl tracking-tight truncate">
              {conversations.find((c) => c.conversation_id === currentId)?.title || "New chat"}
            </h2>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-sub)]" data-testid="use-files-toggle">
            <input type="checkbox" checked={useFiles} onChange={(e) => setUseFiles(e.target.checked)}/>
            <FileText size={14}/> Use my uploaded files
          </label>
        </div>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="max-w-xl">
              <span className="label-tag">Ask anything</span>
              <h3 className="font-display text-3xl mt-2">Start a new line of inquiry.</h3>
              <p className="text-sm text-[var(--text-sub)] mt-3">
                Try: <em>"Summarize the key findings of my uploaded report."</em> or
                <em> "What did Q3 strategy memo recommend?"</em>
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.message_id} className={`animate-in flex ${m.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`msg-${m.role}`}>
              <div className={`max-w-[80%] surface-card p-4 ${m.role === "user" ? "border-[var(--accent)]" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="label-tag">{m.role === "user" ? "You" : "Lexicon"}</span>
                  {m.role === "assistant" && !m.message_id.startsWith("tmp_") && (
                    <Link to={`/response/${m.message_id}`} className="text-[var(--text-sub)] hover:text-[var(--accent)] inline-flex items-center gap-1 text-xs" data-testid="view-response-detail">
                      Open <ExternalLink size={12}/>
                    </Link>
                  )}
                </div>
                <div className="chat-md text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start animate-in">
              <div className="surface-card p-4 text-xs text-[var(--text-sub)]">Lexicon is thinking…</div>
            </div>
          )}
        </div>

        <form onSubmit={send} className="border-t border-[var(--border)] p-4 flex gap-3 bg-[var(--surface)]" data-testid="chat-form">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Lexicon a question…"
            className="input-field flex-1"
            data-testid="chat-input"
          />
          <button type="submit" disabled={sending || !input.trim()} className="btn-primary inline-flex items-center gap-2" data-testid="chat-send">
            <Send size={14}/> Send
          </button>
        </form>
      </section>
    </div>
  );
}
