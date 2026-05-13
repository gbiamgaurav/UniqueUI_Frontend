"""
Chatbot SaaS Backend - FastAPI
- JWT email/password auth + Emergent Google OAuth (unified user model)
- Groq LLM chat completions
- File upload + PDF/DOCX/TXT parsing for RAG context
- Conversations & messages persistence in MongoDB
"""
import os
import io
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
from jose import jwt, JWTError
from passlib.context import CryptContext
from groq import Groq
from pypdf import PdfReader
import docx as docx_lib

load_dotenv()

# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
GROQ_API_KEY = os.environ["GROQ_API_KEY"]
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chatbot")

# ---------- Init ----------
app = FastAPI(title="Chatbot SaaS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
groq_client = Groq(api_key=GROQ_API_KEY)


# ---------- Models ----------
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    auth_provider: str
    created_at: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    use_files: bool = True


class ChatMessageOut(BaseModel):
    message_id: str
    role: str
    content: str
    created_at: str


class ConversationOut(BaseModel):
    conversation_id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int


class ConversationDetail(BaseModel):
    conversation_id: str
    title: str
    created_at: str
    updated_at: str
    messages: List[ChatMessageOut]


class FileOut(BaseModel):
    file_id: str
    filename: str
    size: int
    content_type: str
    created_at: str
    excerpt: str


class DashboardStats(BaseModel):
    total_conversations: int
    total_questions: int
    total_files: int
    recent_activity: List[dict]
    questions_per_day: List[dict]


# ---------- Helpers ----------
def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": utcnow() + timedelta(days=JWT_EXPIRY_DAYS),
        "iat": utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def hash_password(pw: str) -> str:
    return pwd_ctx.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    return pwd_ctx.verify(pw, hashed)


def user_to_public(doc: dict) -> UserPublic:
    return UserPublic(
        user_id=doc["user_id"],
        email=doc["email"],
        name=doc.get("name", ""),
        picture=doc.get("picture"),
        auth_provider=doc.get("auth_provider", "jwt"),
        created_at=doc["created_at"] if isinstance(doc["created_at"], str) else doc["created_at"].isoformat(),
    )


async def get_current_user(request: Request) -> dict:
    """Auth: accept either Bearer JWT (custom auth) OR session_token cookie/Bearer (Emergent OAuth)."""
    token: Optional[str] = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if not token:
        token = request.cookies.get("session_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Try JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            if user:
                return user
    except JWTError:
        pass

    # Try Emergent session token
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        expires_at = session.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at and expires_at < utcnow():
            raise HTTPException(status_code=401, detail="Session expired")
        user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
        if user:
            return user

    raise HTTPException(status_code=401, detail="Invalid or expired token")


# ---------- File parsing ----------
def extract_text(filename: str, content_type: str, raw: bytes) -> str:
    name = filename.lower()
    try:
        if name.endswith(".pdf") or content_type == "application/pdf":
            reader = PdfReader(io.BytesIO(raw))
            return "\n".join((page.extract_text() or "") for page in reader.pages)
        if name.endswith(".docx") or content_type in (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ):
            doc = docx_lib.Document(io.BytesIO(raw))
            return "\n".join(p.text for p in doc.paragraphs)
        # txt / md / fallback
        return raw.decode("utf-8", errors="ignore")
    except Exception as e:
        logger.warning(f"text extract failed for {filename}: {e}")
        return ""


# ---------- Routes ----------
@app.get("/api/health")
async def health():
    return {"status": "ok", "time": utcnow_iso()}


# ----- Auth: JWT custom -----
@app.post("/api/auth/signup", response_model=AuthResponse)
async def signup(body: SignupRequest):
    existing = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": body.email.lower(),
        "name": body.name,
        "password_hash": hash_password(body.password),
        "picture": None,
        "auth_provider": "jwt",
        "created_at": utcnow_iso(),
    }
    await db.users.insert_one(user_doc)
    token = create_jwt(user_id)
    return AuthResponse(access_token=token, user=user_to_public(user_doc))


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt(user["user_id"])
    return AuthResponse(access_token=token, user=user_to_public(user))


@app.get("/api/auth/me", response_model=UserPublic)
async def me(current=Depends(get_current_user)):
    return user_to_public(current)


@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ----- Auth: Emergent Google OAuth -----
@app.post("/api/auth/google/session")
async def google_session(request: Request, response: Response):
    """Exchange Emergent session_id for session_token; persist user; set httpOnly cookie."""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing X-Session-ID")

    async with httpx.AsyncClient(timeout=15.0) as ac:
        r = await ac.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="OAuth exchange failed")
    data = r.json()
    email = data["email"].lower()
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "auth_provider": existing.get("auth_provider", "google")}},
        )
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "auth_provider": "google",
            "created_at": utcnow_iso(),
        }
        await db.users.insert_one(user_doc)

    # Upsert session
    expires_at = utcnow() + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {
            "$set": {
                "user_id": user_id,
                "session_token": session_token,
                "expires_at": expires_at,
                "created_at": utcnow(),
            }
        },
        upsert=True,
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",
    )
    return {"user": user_to_public(user_doc), "access_token": session_token, "token_type": "bearer"}


# ----- Conversations -----
async def _conversation_summary(conv: dict) -> ConversationOut:
    count = await db.messages.count_documents({"conversation_id": conv["conversation_id"]})
    return ConversationOut(
        conversation_id=conv["conversation_id"],
        title=conv.get("title", "New chat"),
        created_at=conv["created_at"],
        updated_at=conv.get("updated_at", conv["created_at"]),
        message_count=count,
    )


@app.get("/api/conversations", response_model=List[ConversationOut])
async def list_conversations(current=Depends(get_current_user)):
    cursor = db.conversations.find({"user_id": current["user_id"]}, {"_id": 0}).sort("updated_at", -1)
    items = []
    async for c in cursor:
        items.append(await _conversation_summary(c))
    return items


@app.post("/api/conversations", response_model=ConversationOut)
async def create_conversation(current=Depends(get_current_user)):
    cid = f"conv_{uuid.uuid4().hex[:12]}"
    now = utcnow_iso()
    doc = {
        "conversation_id": cid,
        "user_id": current["user_id"],
        "title": "New chat",
        "created_at": now,
        "updated_at": now,
    }
    await db.conversations.insert_one(doc)
    return await _conversation_summary(doc)


@app.get("/api/conversations/{cid}", response_model=ConversationDetail)
async def get_conversation(cid: str, current=Depends(get_current_user)):
    conv = await db.conversations.find_one(
        {"conversation_id": cid, "user_id": current["user_id"]}, {"_id": 0}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs_cursor = db.messages.find({"conversation_id": cid}, {"_id": 0}).sort("created_at", 1)
    msgs = []
    async for m in msgs_cursor:
        msgs.append(
            ChatMessageOut(
                message_id=m["message_id"],
                role=m["role"],
                content=m["content"],
                created_at=m["created_at"],
            )
        )
    return ConversationDetail(
        conversation_id=conv["conversation_id"],
        title=conv.get("title", "New chat"),
        created_at=conv["created_at"],
        updated_at=conv.get("updated_at", conv["created_at"]),
        messages=msgs,
    )


@app.delete("/api/conversations/{cid}")
async def delete_conversation(cid: str, current=Depends(get_current_user)):
    res = await db.conversations.delete_one({"conversation_id": cid, "user_id": current["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.messages.delete_many({"conversation_id": cid})
    return {"ok": True}


# ----- Chat (Groq) -----
def _build_rag_context(files: list[dict], max_chars: int = 8000) -> str:
    """Concatenate file excerpts as context, truncated to max_chars."""
    if not files:
        return ""
    parts = []
    used = 0
    for f in files:
        text = f.get("text") or ""
        if not text:
            continue
        chunk = f"\n\n--- Document: {f['filename']} ---\n{text.strip()}\n"
        if used + len(chunk) > max_chars:
            chunk = chunk[: max_chars - used]
            parts.append(chunk)
            break
        parts.append(chunk)
        used += len(chunk)
    return "".join(parts)


@app.post("/api/chat")
async def chat(body: ChatRequest, current=Depends(get_current_user)):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Empty message")

    # Resolve / create conversation
    if body.conversation_id:
        conv = await db.conversations.find_one(
            {"conversation_id": body.conversation_id, "user_id": current["user_id"]}, {"_id": 0}
        )
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        cid = f"conv_{uuid.uuid4().hex[:12]}"
        now = utcnow_iso()
        conv = {
            "conversation_id": cid,
            "user_id": current["user_id"],
            "title": body.message[:60],
            "created_at": now,
            "updated_at": now,
        }
        await db.conversations.insert_one(conv)

    # Persist user message
    user_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = utcnow_iso()
    await db.messages.insert_one(
        {
            "message_id": user_msg_id,
            "conversation_id": conv["conversation_id"],
            "user_id": current["user_id"],
            "role": "user",
            "content": body.message,
            "created_at": now,
        }
    )

    # Build messages with history (last 20)
    history_cursor = db.messages.find(
        {"conversation_id": conv["conversation_id"]}, {"_id": 0}
    ).sort("created_at", 1)
    history = [m async for m in history_cursor]
    history = history[-20:]

    # System prompt + optional RAG context
    system = (
        "You are a precise, helpful AI assistant for a SaaS chatbot product. "
        "Be concise, use markdown when helpful. If the user references their uploaded "
        "documents, ground your answer in the provided context. Cite the document name "
        "when you use it."
    )
    if body.use_files:
        files = await db.files.find({"user_id": current["user_id"]}, {"_id": 0}).to_list(length=20)
        ctx = _build_rag_context(files)
        if ctx:
            system += f"\n\nUSER DOCUMENT CONTEXT:\n{ctx}"

    messages = [{"role": "system", "content": system}]
    for m in history:
        messages.append({"role": m["role"], "content": m["content"]})

    # Call Groq
    try:
        completion = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        assistant_text = completion.choices[0].message.content or ""
    except Exception as e:
        logger.exception("groq call failed")
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    # Persist assistant message
    asst_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    asst_time = utcnow_iso()
    await db.messages.insert_one(
        {
            "message_id": asst_msg_id,
            "conversation_id": conv["conversation_id"],
            "user_id": current["user_id"],
            "role": "assistant",
            "content": assistant_text,
            "created_at": asst_time,
        }
    )
    # Update conv title (first user msg) + updated_at
    update = {"updated_at": asst_time}
    if conv.get("title") in (None, "", "New chat"):
        update["title"] = body.message[:60]
    await db.conversations.update_one(
        {"conversation_id": conv["conversation_id"]}, {"$set": update}
    )

    return {
        "conversation_id": conv["conversation_id"],
        "user_message": {
            "message_id": user_msg_id,
            "role": "user",
            "content": body.message,
            "created_at": now,
        },
        "assistant_message": {
            "message_id": asst_msg_id,
            "role": "assistant",
            "content": assistant_text,
            "created_at": asst_time,
        },
    }


@app.get("/api/messages/{mid}", response_model=ChatMessageOut)
async def get_message(mid: str, current=Depends(get_current_user)):
    m = await db.messages.find_one(
        {"message_id": mid, "user_id": current["user_id"]}, {"_id": 0}
    )
    if not m:
        raise HTTPException(status_code=404, detail="Message not found")
    return ChatMessageOut(
        message_id=m["message_id"],
        role=m["role"],
        content=m["content"],
        created_at=m["created_at"],
    )


# ----- Files / RAG -----
ALLOWED_EXT = (".pdf", ".txt", ".md", ".docx")


@app.post("/api/files/upload", response_model=FileOut)
async def upload_file(file: UploadFile = File(...), current=Depends(get_current_user)):
    name = (file.filename or "file").strip()
    if not name.lower().endswith(ALLOWED_EXT):
        raise HTTPException(status_code=400, detail="Only .pdf, .txt, .md, .docx allowed")
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    text = extract_text(name, file.content_type or "", raw)
    fid = f"file_{uuid.uuid4().hex[:12]}"
    doc = {
        "file_id": fid,
        "user_id": current["user_id"],
        "filename": name,
        "size": len(raw),
        "content_type": file.content_type or "",
        "text": text,
        "created_at": utcnow_iso(),
    }
    await db.files.insert_one(doc)
    return FileOut(
        file_id=fid,
        filename=name,
        size=len(raw),
        content_type=doc["content_type"],
        created_at=doc["created_at"],
        excerpt=(text[:200] if text else ""),
    )


@app.get("/api/files", response_model=List[FileOut])
async def list_files(current=Depends(get_current_user)):
    out: List[FileOut] = []
    cursor = db.files.find({"user_id": current["user_id"]}, {"_id": 0}).sort("created_at", -1)
    async for f in cursor:
        out.append(
            FileOut(
                file_id=f["file_id"],
                filename=f["filename"],
                size=f["size"],
                content_type=f.get("content_type", ""),
                created_at=f["created_at"],
                excerpt=(f.get("text", "")[:200] if f.get("text") else ""),
            )
        )
    return out


@app.delete("/api/files/{fid}")
async def delete_file(fid: str, current=Depends(get_current_user)):
    res = await db.files.delete_one({"file_id": fid, "user_id": current["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="File not found")
    return {"ok": True}


# ----- Dashboard -----
@app.get("/api/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats(current=Depends(get_current_user)):
    uid = current["user_id"]
    total_convs = await db.conversations.count_documents({"user_id": uid})
    total_qs = await db.messages.count_documents({"user_id": uid, "role": "user"})
    total_files = await db.files.count_documents({"user_id": uid})

    # Recent activity: last 5 messages
    recent_cursor = db.messages.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(5)
    recent = []
    async for m in recent_cursor:
        recent.append(
            {
                "message_id": m["message_id"],
                "conversation_id": m["conversation_id"],
                "role": m["role"],
                "content": m["content"][:120],
                "created_at": m["created_at"],
            }
        )

    # Questions per day (last 7 days)
    now = utcnow()
    buckets = {}
    for i in range(7):
        day = (now - timedelta(days=i)).date().isoformat()
        buckets[day] = 0
    cursor = db.messages.find(
        {"user_id": uid, "role": "user"}, {"_id": 0, "created_at": 1}
    )
    async for m in cursor:
        try:
            d = datetime.fromisoformat(m["created_at"]).date().isoformat()
            if d in buckets:
                buckets[d] += 1
        except Exception:
            continue
    qpd = [{"date": k, "count": v} for k, v in sorted(buckets.items())]

    return DashboardStats(
        total_conversations=total_convs,
        total_questions=total_qs,
        total_files=total_files,
        recent_activity=recent,
        questions_per_day=qpd,
    )


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.conversations.create_index([("user_id", 1), ("updated_at", -1)])
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await db.files.create_index([("user_id", 1), ("created_at", -1)])
    await db.user_sessions.create_index("session_token", unique=True)
    logger.info("Chatbot backend started.")
