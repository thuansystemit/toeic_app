# Social Login Setup (Google & Facebook)

This guide walks through obtaining the OAuth credentials and wiring them into the
app so the **Sign in with Google** and **Continue with Facebook** buttons go live.

## How it works (flow)

```
Frontend SDK  →  returns a token  →  POST /api/auth/{google|facebook}
                                          │
                                          ▼
                          Backend verifies the token with the provider,
                          finds-or-creates the user (linked by email),
                          and issues our normal JWT session.
```

- **Google** → frontend returns an **ID token**; backend verifies it with `google-auth-library`.
- **Facebook** → frontend returns an **access token**; backend verifies it via the Facebook Graph API.
- Accounts are **linked by verified email**: signing in with a provider whose email
  matches an existing account logs into that account; otherwise a new passwordless
  learner account is created.

## Where the keys go

Two `.env` files. The Google **Client ID** is public and goes in **both**; secrets
go **only** in the backend.

| Variable | File | Purpose |
|----------|------|---------|
| `GOOGLE_CLIENT_ID` | `backend/.env` | Verify Google ID tokens |
| `VITE_GOOGLE_CLIENT_ID` | `frontend/.env` | Render the Google button (same value as above) |
| `FACEBOOK_APP_ID` | `backend/.env` | Verify Facebook tokens |
| `FACEBOOK_APP_SECRET` | `backend/.env` | App access token for verification (**secret — backend only**) |
| `VITE_FACEBOOK_APP_ID` | `frontend/.env` | Render the Facebook button (same App ID) |

> Leave a value blank to keep that provider disabled — its button shows a
> "not configured yet" state instead of breaking.

Reference templates: [`backend/.env.example`](../backend/.env.example) and `frontend/.env`.

---

## Google setup

1. **Open the console** → <https://console.cloud.google.com> → sign in.
2. **Create/select a project** — top bar project dropdown → **New Project** → name it
   (e.g. "TOEIC App") → Create → select it.
3. **Configure the consent screen** (one-time) — ☰ menu →
   **APIs & Services → OAuth consent screen** (newer UI: **Google Auth Platform → Branding**):
   - **User type: External** → Create
   - Fill **App name**, **User support email**, **Developer contact email** → Save.
   - It stays in **Testing** mode (fine for dev).
   - Under **Audience → Test users**, click **Add users** and add **your own Gmail**.
     *(In Testing mode only listed test users can sign in.)*
4. **Create the OAuth client** — **APIs & Services → Credentials** →
   **+ Create Credentials → OAuth client ID**:
   - **Application type: Web application**
   - **Name:** anything (e.g. "TOEIC Web")
   - **Authorized JavaScript origins → + Add URI:**
     ```
     http://localhost:5173
     ```
     *(This is the field that matters for our flow. Leave "Authorized redirect URIs" empty.)*
   - **Create**.
5. **Copy the Client ID** — looks like
   `1234567890-abc123.apps.googleusercontent.com`.
   *(You can ignore the Client Secret — the Google flow only needs the Client ID.)*
6. **Paste the same value into both files:**
   ```dotenv
   # backend/.env
   GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
   ```
   ```dotenv
   # frontend/.env
   VITE_GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
   ```

---

## Facebook setup

1. **Open** <https://developers.facebook.com/apps> → log in → **Create App**.
2. Choose use case **Authenticate and request data from users with Facebook Login**
   (a "Consumer"/"None" type app also works) → fill app name + contact email → Create.
3. **Add the Facebook Login product** → in the left sidebar **Add product →
   Facebook Login → Set up** (Web).
4. **Facebook Login → Settings:**
   - **Valid OAuth Redirect URIs:** `http://localhost:5173/`
     *(JS-SDK login also relies on the App Domain / site URL below.)*
   - Under **Settings → Basic**: set **App domains** = `localhost`, and add a
     **Website** platform with Site URL `http://localhost:5173`.
5. **Get credentials** — **Settings → Basic**:
   - **App ID** (public)
   - **App Secret** (click **Show**, keep it private)
6. **Paste into the files:**
   ```dotenv
   # backend/.env
   FACEBOOK_APP_ID=000000000000000
   FACEBOOK_APP_SECRET=your-app-secret
   ```
   ```dotenv
   # frontend/.env
   VITE_FACEBOOK_APP_ID=000000000000000
   ```
7. **Test users:** while the app is in **Development** mode, only **App Roles →
   Roles** members (admins/testers) or **Roles → Test Users** can log in. Add
   yourself, or switch the app to **Live** for public access.
   - Email permission: the app requests `email`; if a user denies it, the backend
     returns *"Email permission is required for Facebook login."*

---

## Apply the changes

Both processes read their `.env` at startup, so restart them (Postgres/Docker is
**not** involved — the keys are not stored in the database):

```bash
# from the repo root
npm run backend:dev     # or restart your running backend process
npm run frontend:dev    # Vite must restart to pick up VITE_* values
```

## Verify it worked

- **Backend configured?** A bad token should return **401** (verifying), not **503**
  (disabled):
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/api/auth/google \
    -H 'Content-Type: application/json' -d '{"idToken":"garbage"}'
  # 401 = configured ✓   503 = still disabled
  ```
- **Frontend:** hard-refresh <http://localhost:5173> (⌘⇧R). The real provider
  buttons render under "or continue with". Click → authorize → you land on the
  dashboard.

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| Google `403 / access_denied` | Add your Gmail under **Audience → Test users** (consent screen in Testing mode). |
| Google `origin_mismatch` / button missing | Add `http://localhost:5173` to **Authorized JavaScript origins**. |
| Endpoint returns **503** | The matching `*_CLIENT_ID` / `APP_ID` is blank in `.env`, or the server wasn't restarted. |
| Facebook login closes with no result | App in Development mode and you're not a tester; add yourself in **Roles**, or set the app **Live**. |
| "Email permission is required" | User denied the email scope; re-try and grant email. |
| Frontend button still disabled | `frontend/.env` `VITE_*` not set, or Vite not restarted. |

## Production notes

- Add your real origin (e.g. `https://app.yourdomain.com`) to **both** providers'
  allowed origins / redirect URIs.
- Move the Google consent screen out of **Testing** (Publish) and the Facebook app
  to **Live** for public sign-in.
- Keep `FACEBOOK_APP_SECRET` out of version control (`.env` is gitignored).

To actually deliver the reset email to a Gmail inbox, I need real SMTP credentials — I can't generate those. The easiest route (since you want Gmail) is Gmail's own SMTP with an App Password. Here's how to get it, then I'll wire it up.

Step 1 — Enable 2-Step Verification (required for App Passwords)

Google Account → Security → 2-Step Verification → turn it on (if not already).

Step 2 — Create an App Password

Go to https://myaccount.google.com/apppasswords → name it "TOEIC App" → Create.
Google shows a 16-character code like abcd efgh ijkl mnop (use it without spaces → abcdefghijklmnop).

Step 3 — Give me the values (or set them yourself)

I need:
- Gmail address (the sender, e.g. you@gmail.com)
- App Password (the 16-char code)

The config that goes into backend/.env:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=abcdefghijklmnop
MAIL_FROM=TOEIC Platform <you@gmail.com>

---
Two ways to proceed — your call:

1. You paste the address + App Password here → I drop them into backend/.env, restart, and send a real test reset email to verify it lands in your inbox.
2. More private: you put those lines into backend/.env yourself (I won't see the password), tell me when done, and I'll restart + run the test.

A couple of notes:
- The App Password is not your normal Gmail password — it's a separate generated code, and it only works with 2-Step Verification on.
- Gmail's free SMTP is fine for testing (~500 emails/day). For production you'd typically switch to SES/SendGrid/Resend — but the same .env swap applies.

Which option do you want? If #1, paste the Gmail address and App Password.
