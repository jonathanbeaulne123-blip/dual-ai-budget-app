# Supabase Auth — Google provider setup (D-123 Q1 A)

Step-by-step for project `tykhocwacaxwquhynkok`. This is **Supabase Auth** (JWT / `auth.uid()`), separate from the existing GIS `VITE_GOOGLE_CLIENT_ID` household bridge.

Kitchen URL: https://hearth-books.jonathan-beaulne123.workers.dev/  
Supabase project: https://supabase.com/dashboard/project/tykhocwacaxwquhynkok  
SQL Editor: https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/sql/new

---

## 1. Google Cloud — OAuth Web client (with secret)

Supabase Auth needs a **Client ID + Client Secret**. The GIS client used for Calendar may be secret-less in the kitchen; create or reuse a Web client that has a secret, and keep that secret **only** in the Supabase dashboard (never `VITE_`, never git).

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Pick the Hearth project (same one as [GOOGLE.md](GOOGLE.md) if possible).
3. [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
4. **Create credentials → OAuth client ID → Web application**  
   (or open an existing Web client and ensure a client secret exists).
5. **Authorized JavaScript origins** — add:
   - `http://localhost:5173`
   - `https://hearth-books.jonathan-beaulne123.workers.dev`
6. **Authorized redirect URIs** — add exactly:
   - `https://tykhocwacaxwquhynkok.supabase.co/auth/v1/callback`
7. Save. Copy **Client ID** and **Client Secret**.

Consent screen: [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)  
While in Testing, add Jonathan and Bianca as **test users**. Scopes for Auth sign-in: `openid`, `email`, `profile`.

---

## 2. Supabase — enable Google provider

1. Open [Authentication → Providers](https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/auth/providers)
2. Click **Google**
3. Enable it
4. Paste **Client ID** and **Client Secret** from Google Cloud
5. Save

---

## 3. Supabase — allow kitchen redirect URLs

1. Open [Authentication → URL Configuration](https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/auth/url-configuration)
2. **Site URL** (recommended): `https://hearth-books.jonathan-beaulne123.workers.dev`
3. **Redirect URLs** allow list — add:
   - `https://hearth-books.jonathan-beaulne123.workers.dev/**`
   - `http://localhost:5173/**`
4. Save

Hearth builds `redirect_to` as the current page plus `?hearthAuthEnv=development|production` (see `src/auth/supabaseSession.ts`).

---

## 4. Kitchen build flag (Auth-enabled kitchen)

Auth code is behind `VITE_SUPABASE_AUTH_ENABLED=1`. The live Worker bakes Vite env at `pnpm build` from GitHub Actions **variables** (see `.github/workflows/pages.yml`).

**Live kitchen (preferred when localhost is unavailable)**

1. Open [GitHub → Settings → Secrets and variables → Actions → Variables](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/settings/variables/actions)
2. Add variable `VITE_SUPABASE_AUTH_ENABLED` = `1` (not a secret)
3. Optional overrides (usually skip — kitchen falls back to the bundled Development project URL/publishable key):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable/anon only — never service_role)
4. Confirm redirect allow list includes `https://hearth-books.jonathan-beaulne123.workers.dev/**`
5. Deploy: merge to `main`, or [Actions → Cloudflare Workers → Run workflow](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/workflows/pages.yml) on `main`
6. Hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ → **Continue with Google**

Publishable key reference: [Project Settings → API](https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/settings/api)  
Never put the **service_role** or database password in `VITE_` or Actions variables.

---

## 5. Prove identities exist

1. On a clean browser profile, open the kitchen (or localhost with the flag).
2. Jonathan: **Continue with Google** once.
3. Bianca: same on her account.
4. Run section 7 of the preflight:

```sql
SELECT
  users.id AS auth_user_id,
  users.email,
  identities.provider,
  identities.provider_id,
  users.created_at
FROM auth.users AS users
LEFT JOIN auth.identities AS identities
  ON identities.user_id = users.id
ORDER BY users.created_at;
```

Expect: two Google rows (Jonathan + Bianca). Download CSV and keep it.

Optional bind re-run (004 one-shot) after identities exist — only when memberships exist to bind. With zero households after Production delete, skip bind until a household + membership rows exist.

---

## 6. What this does *not* do

- Does not apply migration `006`
- Does not turn on `VITE_PRODUCTION_CONTINUITY` (stays off until separately approved)
- Does not replace GIS Calendar/`VITE_GOOGLE_CLIENT_ID` setup in [GOOGLE.md](GOOGLE.md)
