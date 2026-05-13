import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Sun, Moon, LogOut, LayoutGrid, MessageSquare, FileUp, User } from "lucide-react";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const navItem = ({ isActive }) =>
    `px-3 py-2 text-xs tracking-widest uppercase border-b-2 transition-colors ${
      isActive ? "border-[var(--accent)] text-[var(--text)]" : "border-transparent text-[var(--text-sub)] hover:text-[var(--text)]"
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass-nav sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3" data-testid="brand-home">
            <span className="dot" />
            <span className="font-display text-2xl tracking-tight">Lexicon</span>
            <span className="label-tag hidden sm:inline ml-2">— a chatbot that reads your docs</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/dashboard" className={navItem} data-testid="nav-dashboard">
              <span className="inline-flex items-center gap-2"><LayoutGrid size={14}/> Dashboard</span>
            </NavLink>
            <NavLink to="/chat" className={navItem} data-testid="nav-chat">
              <span className="inline-flex items-center gap-2"><MessageSquare size={14}/> Chat</span>
            </NavLink>
            <NavLink to="/files" className={navItem} data-testid="nav-files">
              <span className="inline-flex items-center gap-2"><FileUp size={14}/> Files</span>
            </NavLink>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="btn-ghost !p-2" data-testid="theme-toggle" aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            <div className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                className="btn-ghost !p-2 flex items-center gap-2"
                data-testid="profile-menu-trigger"
              >
                {user?.picture ? (
                  <img src={user.picture} alt="" className="w-6 h-6 rounded-sm object-cover" />
                ) : (
                  <User size={16}/>
                )}
                <span className="hidden sm:inline text-xs tracking-wider">{user?.name || user?.email}</span>
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-56 surface-card animate-in p-1" onMouseLeave={() => setOpen(false)}>
                  <div className="px-3 py-2 text-xs">
                    <div className="font-semibold truncate">{user?.name}</div>
                    <div className="text-[var(--text-sub)] truncate">{user?.email}</div>
                  </div>
                  <button
                    onClick={async () => { await logout(); navigate("/"); }}
                    className="w-full text-left px-3 py-2 text-xs tracking-wider uppercase hover:bg-[color:var(--border)] flex items-center gap-2"
                    data-testid="logout-button"
                  >
                    <LogOut size={14}/> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
