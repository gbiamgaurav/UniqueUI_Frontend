"""Backend integration tests for Lexicon chatbot.
Covers: health, JWT auth, conversations, chat (Groq), messages, files, dashboard,
cross-user isolation, OAuth session bearer.
"""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://17e13efb-9e7f-437b-b234-8f298c58548c.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TS = int(time.time())
USER_A_EMAIL = f"tester+a{TS}@example.com"
USER_B_EMAIL = f"tester+b{TS}@example.com"
PASSWORD = "TestPass!234"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_a(session):
    r = session.post(f"{API}/auth/signup", json={"email": USER_A_EMAIL, "password": PASSWORD, "name": "Tester A"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["access_token"], "user": data["user"]}


@pytest.fixture(scope="module")
def user_b(session):
    r = session.post(f"{API}/auth/signup", json={"email": USER_B_EMAIL, "password": PASSWORD, "name": "Tester B"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["access_token"], "user": data["user"]}


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health ----------
class TestHealth:
    def test_health_ok(self, session):
        r = session.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_signup_returns_bearer_and_user(self, user_a):
        assert user_a["token"]
        assert user_a["user"]["email"] == USER_A_EMAIL
        assert user_a["user"]["auth_provider"] == "jwt"

    def test_signup_duplicate_400(self, session):
        r = session.post(f"{API}/auth/signup", json={"email": USER_A_EMAIL, "password": PASSWORD, "name": "Dup"})
        assert r.status_code == 400

    def test_login_success(self, session):
        r = session.post(f"{API}/auth/login", json={"email": USER_A_EMAIL, "password": PASSWORD})
        assert r.status_code == 200
        assert "access_token" in r.json()
        assert r.json()["user"]["email"] == USER_A_EMAIL

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"email": USER_A_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_token(self, session, user_a):
        r = session.get(f"{API}/auth/me", headers=H(user_a["token"]))
        assert r.status_code == 200
        assert r.json()["email"] == USER_A_EMAIL

    def test_me_no_token_401(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token_401(self, session):
        r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
        assert r.status_code == 401


# ---------- Conversations + Chat ----------
class TestChatFlow:
    convo_id = None
    asst_msg_id = None

    def test_chat_creates_conversation_and_calls_groq(self, session, user_a):
        r = session.post(
            f"{API}/chat",
            headers=H(user_a["token"]),
            json={"message": "Reply with the single word: PONG", "use_files": False},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "conversation_id" in data
        assert data["assistant_message"]["role"] == "assistant"
        assert len(data["assistant_message"]["content"]) > 0
        TestChatFlow.convo_id = data["conversation_id"]
        TestChatFlow.asst_msg_id = data["assistant_message"]["message_id"]

    def test_list_conversations(self, session, user_a):
        r = session.get(f"{API}/conversations", headers=H(user_a["token"]))
        assert r.status_code == 200
        ids = [c["conversation_id"] for c in r.json()]
        assert TestChatFlow.convo_id in ids

    def test_get_conversation_detail(self, session, user_a):
        r = session.get(f"{API}/conversations/{TestChatFlow.convo_id}", headers=H(user_a["token"]))
        assert r.status_code == 200
        assert len(r.json()["messages"]) >= 2

    def test_get_message_by_id(self, session, user_a):
        r = session.get(f"{API}/messages/{TestChatFlow.asst_msg_id}", headers=H(user_a["token"]))
        assert r.status_code == 200
        assert r.json()["role"] == "assistant"

    def test_chat_use_files_true_still_works(self, session, user_a):
        r = session.post(
            f"{API}/chat",
            headers=H(user_a["token"]),
            json={"conversation_id": TestChatFlow.convo_id, "message": "Say OK.", "use_files": True},
        )
        assert r.status_code == 200
        assert r.json()["assistant_message"]["content"]

    def test_empty_message_rejected(self, session, user_a):
        r = session.post(f"{API}/chat", headers=H(user_a["token"]), json={"message": "   "})
        assert r.status_code == 400


# ---------- Files ----------
class TestFiles:
    file_id = None

    def test_upload_txt(self, user_a):
        files = {"file": ("notes.txt", io.BytesIO(b"Lexicon test corpus: zephyr is the password."), "text/plain")}
        r = requests.post(f"{API}/files/upload", headers={"Authorization": f"Bearer {user_a['token']}"}, files=files)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["filename"] == "notes.txt"
        assert data["size"] > 0
        assert "zephyr" in data["excerpt"]
        TestFiles.file_id = data["file_id"]

    def test_upload_rejects_unsupported(self, user_a):
        files = {"file": ("bad.exe", io.BytesIO(b"MZ"), "application/octet-stream")}
        r = requests.post(f"{API}/files/upload", headers={"Authorization": f"Bearer {user_a['token']}"}, files=files)
        assert r.status_code == 400

    def test_upload_too_large(self, user_a):
        big = b"x" * (10 * 1024 * 1024 + 10)
        files = {"file": ("big.txt", io.BytesIO(big), "text/plain")}
        r = requests.post(f"{API}/files/upload", headers={"Authorization": f"Bearer {user_a['token']}"}, files=files)
        assert r.status_code == 400

    def test_list_files(self, session, user_a):
        r = session.get(f"{API}/files", headers=H(user_a["token"]))
        assert r.status_code == 200
        ids = [f["file_id"] for f in r.json()]
        assert TestFiles.file_id in ids

    def test_delete_file(self, session, user_a):
        r = session.delete(f"{API}/files/{TestFiles.file_id}", headers=H(user_a["token"]))
        assert r.status_code == 200
        # verify removal
        r2 = session.get(f"{API}/files", headers=H(user_a["token"]))
        ids = [f["file_id"] for f in r2.json()]
        assert TestFiles.file_id not in ids


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_stats(self, session, user_a):
        r = session.get(f"{API}/dashboard/stats", headers=H(user_a["token"]))
        assert r.status_code == 200
        d = r.json()
        assert d["total_conversations"] >= 1
        assert d["total_questions"] >= 1
        assert isinstance(d["recent_activity"], list)
        assert isinstance(d["questions_per_day"], list)
        assert len(d["questions_per_day"]) == 7
        # Each bucket has date+count
        for bucket in d["questions_per_day"]:
            assert "date" in bucket and "count" in bucket


# ---------- Cross-user isolation ----------
class TestIsolation:
    def test_user_b_cannot_see_user_a_conversation(self, session, user_a, user_b):
        # user A created at least one conv earlier
        r = session.get(f"{API}/conversations/{TestChatFlow.convo_id}", headers=H(user_b["token"]))
        assert r.status_code == 404

    def test_user_b_cannot_see_user_a_message(self, session, user_b):
        r = session.get(f"{API}/messages/{TestChatFlow.asst_msg_id}", headers=H(user_b["token"]))
        assert r.status_code == 404

    def test_user_b_files_list_isolated(self, session, user_b):
        r = session.get(f"{API}/files", headers=H(user_b["token"]))
        assert r.status_code == 200
        assert r.json() == []


# ---------- OAuth session bearer fixture ----------
class TestOAuthSessionBearer:
    """Simulate post-OAuth state: insert a user_sessions row, then call /me with Bearer."""

    def test_session_token_works_as_bearer(self, session):
        import subprocess
        token = f"test_session_{uuid.uuid4().hex}"
        uid = f"user_{uuid.uuid4().hex[:12]}"
        email = f"oauth.test.{TS}@example.com"
        js = f"""
        use('chatbot_db');
        db.users.insertOne({{
          user_id: '{uid}', email: '{email}', name: 'OAuth Tester', picture: null,
          auth_provider: 'google', created_at: new Date().toISOString()
        }});
        db.user_sessions.insertOne({{
          user_id: '{uid}', session_token: '{token}',
          expires_at: new Date(Date.now() + 7*24*60*60*1000), created_at: new Date()
        }});
        """
        res = subprocess.run(["mongosh", "--quiet", "--eval", js], capture_output=True, text=True)
        if res.returncode != 0:
            pytest.skip(f"mongosh not available: {res.stderr}")

        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == email
        assert r.json()["auth_provider"] == "google"


# ---------- Conversation delete ----------
class TestConversationDelete:
    def test_delete_conversation(self, session, user_a):
        # create
        r = session.post(f"{API}/conversations", headers=H(user_a["token"]))
        assert r.status_code == 200
        cid = r.json()["conversation_id"]
        # delete
        r2 = session.delete(f"{API}/conversations/{cid}", headers=H(user_a["token"]))
        assert r2.status_code == 200
        # verify 404
        r3 = session.get(f"{API}/conversations/{cid}", headers=H(user_a["token"]))
        assert r3.status_code == 404
