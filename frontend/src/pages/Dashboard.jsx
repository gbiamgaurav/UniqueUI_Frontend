import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { MessageSquare, FileText, HelpCircle, ArrowRight } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/dashboard/stats");
        setStats(data);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10" data-testid="dashboard-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <span className="label-tag">Workspace</span>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight mt-2">Good to see you, {user?.name?.split(" ")[0] || "friend"}.</h1>
          <p className="text-sm text-[var(--text-sub)] mt-2">Your archive at a glance.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/chat" className="btn-primary inline-flex items-center gap-2" data-testid="dashboard-new-chat">
            New conversation <ArrowRight size={14}/>
          </Link>
          <Link to="/files" className="btn-ghost" data-testid="dashboard-upload-files">Upload files</Link>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)]">
        <Stat label="Conversations" value={stats?.total_conversations ?? "—"} icon={<MessageSquare size={16}/>} />
        <Stat label="Questions asked" value={stats?.total_questions ?? "—"} icon={<HelpCircle size={16}/>} />
        <Stat label="Files indexed" value={stats?.total_files ?? "—"} icon={<FileText size={16}/>} />
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)]">
        <div className="lg:col-span-2 bg-[var(--surface)] p-6">
          <span className="label-tag">Questions · last 7 days</span>
          <div className="h-[260px] mt-4" data-testid="qpd-chart">
            <ResponsiveContainer>
              <BarChart data={stats?.questions_per_day || []}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false}/>
                <XAxis dataKey="date" stroke="var(--text-sub)" fontSize={10} tickFormatter={(d) => d.slice(5)}/>
                <YAxis stroke="var(--text-sub)" fontSize={10} allowDecimals={false}/>
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}/>
                <Bar dataKey="count" fill="var(--accent)" radius={[0, 0, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-[var(--surface)] p-6">
          <span className="label-tag">Recent activity</span>
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {(stats?.recent_activity || []).length === 0 && (
              <li className="text-xs text-[var(--text-sub)] py-3" data-testid="recent-empty">Nothing yet — start a conversation.</li>
            )}
            {(stats?.recent_activity || []).map((a) => (
              <li key={a.message_id} className="py-3" data-testid="recent-item">
                <Link to={`/chat/${a.conversation_id}`} className="block hover:opacity-80">
                  <div className="label-tag">{a.role === "user" ? "You asked" : "Lexicon replied"} · {new Date(a.created_at).toLocaleString()}</div>
                  <div className="text-sm mt-1 truncate">{a.content}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {loading && <div className="label-tag mt-6">Loading…</div>}
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="bg-[var(--surface)] p-6">
      <div className="label-tag flex items-center gap-2">{icon} {label}</div>
      <div className="font-display text-5xl mt-3 tracking-tight" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</div>
    </div>
  );
}
