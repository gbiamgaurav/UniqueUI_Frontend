# Lexicon — Test Credentials

## JWT (email/password) test accounts
The signup endpoint is open. You can create a fresh account on each run, e.g.:

| Email | Password | Name |
| --- | --- | --- |
| lex.tester+<timestamp>@example.com | TestPass!234 | Lex Tester |

For ad-hoc backend testing the following account was pre-created during smoke tests:

| Email | Password |
| --- | --- |
| demo+lex1@example.com | demopass1 |

## Google OAuth (Emergent-managed)
- Login button on `/login` and `/signup` redirects to `https://auth.emergentagent.com/?redirect=<origin>/dashboard`
- After Google auth, frontend at `/dashboard#session_id=...` is routed through `AuthCallback`, which calls `POST /api/auth/google/session` with header `X-Session-ID`.
- Backend stores user + session in MongoDB and sets an httpOnly `session_token` cookie. The same session_token is also returned as a Bearer access_token for the SPA.
- Google accounts are managed by Emergent — there is no app-managed password.

## How the backend validates auth
`get_current_user` accepts either:
1. `Authorization: Bearer <jwt>` — issued by `/api/auth/login` and `/api/auth/signup`
2. `Authorization: Bearer <session_token>` OR `session_token` cookie — issued by `/api/auth/google/session`

## Test fixture for OAuth-gated routes (no real Google needed)
```bash
mongosh --eval "
use('chatbot_db');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'oauth.test.' + Date.now() + '@example.com',
  name: 'OAuth Tester',
  picture: 'https://via.placeholder.com/150',
  auth_provider: 'google',
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('session_token=' + sessionToken);
print('user_id=' + userId);
"
```
Then use `Authorization: Bearer <session_token>` against any `/api/*` endpoint.
