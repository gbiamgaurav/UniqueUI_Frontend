import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { Sun, Moon, ArrowRight } from "lucide-react";

const heroImg =
  "https://images.unsplash.com/photo-1622396481322-3b83d186701b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwYnVpbGRpbmd8ZW58MHx8fHwxNzc4NjU5MTgx&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass-nav">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" data-testid="landing-brand">
            <span className="dot" />
            <span className="font-display text-2xl tracking-tight">Lexicon</span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="btn-ghost !p-2" data-testid="theme-toggle" aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            <Link to="/login" className="btn-ghost" data-testid="landing-login">Sign in</Link>
            <Link to="/signup" className="btn-primary" data-testid="landing-signup">Get started</Link>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7">
          <span className="label-tag">Issue 01 / Knowledge → Conversation</span>
          <h1 className="font-display mt-4 text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[0.95]">
            A chatbot<br/>
            that <em className="italic">reads</em> your<br/>
            documents.
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-[var(--text-sub)]">
            Upload PDFs, DOCX, or plain text. Lexicon indexes them silently and answers your
            questions with grounded, cited responses — powered by Groq's lightning-fast inference.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-primary inline-flex items-center gap-2" data-testid="hero-signup">
              Start free <ArrowRight size={14}/>
            </Link>
            <Link to="/login" className="btn-ghost" data-testid="hero-login">I have an account</Link>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-6 max-w-md">
            <div>
              <div className="font-display text-3xl">07</div>
              <div className="label-tag">Filetypes</div>
            </div>
            <div>
              <div className="font-display text-3xl">∞</div>
              <div className="label-tag">History</div>
            </div>
            <div>
              <div className="font-display text-3xl">2x</div>
              <div className="label-tag">Themes</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="surface-card overflow-hidden">
            <img src={heroImg} alt="Minimalist architecture" className="w-full h-[420px] object-cover" />
          </div>
          <div className="mt-4 flex justify-between label-tag">
            <span>Plate 01</span>
            <span>Lexicon · 2026</span>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)]">
        {[
          { tag: "01", title: "Grounded answers", body: "Every response can cite the document and passage it drew from." },
          { tag: "02", title: "Your private corpus", body: "Files live in your workspace only. Nothing trained, nothing shared." },
          { tag: "03", title: "Dual theme", body: "An editorial light mode for daylight. A dark mode that feels like an IDE." },
        ].map((f) => (
          <div key={f.tag} className="bg-[var(--surface)] p-8">
            <div className="label-tag">{f.tag}</div>
            <h3 className="font-display text-2xl mt-3 tracking-tight">{f.title}</h3>
            <p className="mt-3 text-sm text-[var(--text-sub)] leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 label-tag">
          <span>© 2026 Lexicon</span>
          <span>Built with Groq · React · FastAPI</span>
        </div>
      </footer>
    </div>
  );
}
