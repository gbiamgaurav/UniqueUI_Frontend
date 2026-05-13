# Lexicon — Chatbot SaaS PRD

## Original Problem Statement
Create a Chatbot application with dynamic theme where the user can ask questions and view responses on another page. Add a dashboard for question history per user. Authentication via OAuth or JWT. Allow uploading index files. React/Next.js frontend, Python backend.

## User Choices (verbatim)
- LLM: **Groq** (`llama-3.3-70b-versatile`)
- Auth: **Emergent Google OAuth + JWT email/password (both)**
- Files: **PDF/TXT/DOCX → RAG context for chatbot answers**
- Dashboard: **History + analytics**
- Theme: **Light/Dark toggle + design agent picks aesthetic**

## Architecture
- Backend: FastAPI + Motor (MongoDB) + Groq SDK + pypdf + python-docx
- Frontend: React 18 (CRA) + Tailwind + Recharts + react-markdown + sonner + lucide-react
- DB: `chatbot_db` — collections: users, user_sessions, conversations, messages, files
- Auth helper accepts both JWT Bearer (custom) and session_token (cookie or Bearer) from Emergent OAuth

## User Personas
- Knowledge worker uploading docs and asking grounded questions
- Researcher building a private corpus of references
- Casual user signing in with Google to chat

## Implemented (2026-05-13)
- JWT signup/login/me/logout with bcrypt
- Emergent Google OAuth callback (`POST /api/auth/google/session`), httpOnly cookie
- Groq chat (`llama-3.3-70b-versatile`) with conversation persistence & 20-msg rolling history
- File upload (.pdf/.txt/.md/.docx, 10 MB cap) with text extraction, list, delete
- RAG: concatenated file excerpts (max 8 KB) injected into system prompt when `use_files=true`
- Conversations CRUD, single-message endpoint, dashboard stats with 7-day buckets
- Cross-user isolation enforced via `user_id` scoping
- Frontend: Landing, Login, Signup, AuthCallback, Chat (sidebar+main), Response Detail page, Dashboard (stats + chart + recent activity), Files (drag-drop), Light/Dark theme toggle persisted
- Editorial design system: Cormorant Garamond + IBM Plex Mono, asymmetric layout, sharp borders
- 25/25 backend pytest passed, all critical frontend Playwright flows passed

## Backlog / Future
- P1: Streaming Groq responses (SSE)
- P1: Vector embeddings (true semantic RAG) instead of raw concat
- P2: Multi-file selection per chat instead of all-or-nothing
- P2: Share-a-response public link
- P2: Cost & token usage analytics on dashboard
- P3: Export conversation as Markdown / PDF

## Next Action Items
- Wait for user feedback / new feature requests
