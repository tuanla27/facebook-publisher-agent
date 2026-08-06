# Local Meta Page OAuth Connector (multi-page)

This local connector lets an authenticated Meta user connect **one or more** Facebook Pages and stores each Page Access Token encrypted at rest. It does not publish a post.

You can enter **Meta App ID / App Secret / Graph version** in the local UI (optional encrypted save). `.env` values remain a fallback. `META_TOKEN_ENCRYPTION_KEY` must still live in `.env` — it encrypts App credentials and Page tokens on disk.

`publish_approved_post(post_job_id)` loads the token for the **approved job's `page_id`**, so different jobs can target different connected Pages under the same Meta login.

Meta enforces HTTPS for OAuth redirect URIs. This connector therefore serves **local HTTPS** on `https://localhost:8787` with a self-signed certificate generated under `.local/certs/` (gitignored).

## Requirements

- Node.js 18+ with built-in `fetch`.
- OpenSSL available on `PATH` (used once to create the local cert).
- A Meta App configured for Facebook Login/OAuth.
- The exact callback URI added to the Meta App → Facebook Login → Valid OAuth Redirect URIs:

```text
https://localhost:8787/auth/callback
```

Do not use `http://` — Meta will reject it when Enforce HTTPS is on.

- Current Meta Graph API version and permissions verified against Meta's documentation. The default scopes are a starting point only; Meta may require app review or different permissions.

## Configure

Copy the example environment file and fill it locally:

```bash
cp .env.example .env
```

Generate a local encryption key:

```bash
openssl rand -hex 32
```

Put the output in `META_TOKEN_ENCRYPTION_KEY`. Do not send this key in chat or commit `.env`.

Set at least:

```text
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_GRAPH_API_VERSION=the_current_version
META_OAUTH_REDIRECT_URI=https://localhost:8787/auth/callback
META_TOKEN_ENCRYPTION_KEY=64_hex_characters
META_TARGET_PAGE_NAME=CuocthiPMC
```

`META_TARGET_PAGE_NAME` only highlights a suggested Page in the picker. It does **not** limit how many Pages you can connect.

Optional:

```text
META_OAUTH_HOST=localhost
META_OAUTH_PORT=8787
META_OAUTH_PUBLIC_ORIGIN=https://localhost:8787
```

## Run

```bash
npm run meta:oauth
```

For the one-step local flow, prefer:

```bash
npm run meta:connect
```

It starts the connector if needed and opens the browser automatically. The
coding-agent command `/connect-facebook-page` provides the same flow.

On first start the process creates `.local/certs/localhost-*.pem` if missing.

Open:

```text
https://localhost:8787
```

Accept the browser warning for the self-signed certificate (localhost only). On the home page (one-time technical setup):

1. Enter **App ID**, **App Secret**, and **Graph API version** (or leave blank to use saved / `.env` values).
2. Optionally keep **Lưu App ID/Secret encrypted trên máy**.
3. Click **Connect with Meta**.
4. On the picker, **tick one or more Pages by name** and click **Thêm các Page đã chọn** (or **Thêm tất cả**). The selected Page is stored as the local publish allowlist; users do not need to copy Page IDs into `.env`.

Verify:

```bash
curl -k https://localhost:8787/status
```

(`-k` skips TLS verification for the local self-signed cert.)

Expected response contains only non-secret metadata:

```json
{
  "connected": true,
  "count": 2,
  "app": {
    "app_id": "...",
    "graph_api_version": "v22.0",
    "has_secret": true
  },
  "pages": [
    {
      "page_id": "...",
      "page_name": "...",
      "tasks": [],
      "connected_at": "..."
    }
  ]
}
```

`/status` never returns App Secret or Page tokens.

Encrypted vaults (gitignored):

- `.local/meta-app-credentials.enc.json` — optional saved App ID/Secret
- `.local/meta-page-connections.enc.json` — connected Pages

A legacy single-page file `.local/meta-page-connection.enc.json` is migrated automatically on first read, then removed.

## Publishing to a chosen Page

1. Connect the target Page(s) here.
2. Put that Page's `page_id` on the post job / generated artifact.
3. Approve the exact variant + assets + Page.
4. Run:

```bash
npm run meta:publish -- <post_job_id>
```

The publisher resolves the encrypted token with `loadPageConnection(approved_page_id)`.

## Meta App Checklist

1. Facebook Login for Business / Facebook Login is enabled.
2. Client OAuth Login and Web OAuth Login are on.
3. Enforce HTTPS stays on.
4. Valid OAuth Redirect URIs contains exactly `https://localhost:8787/auth/callback`.
5. `META_OAUTH_REDIRECT_URI` matches that string character-for-character.

## Security Boundary

This is a local bootstrap connector. Before production:

- move OAuth and token storage to an authenticated backend with a real TLS certificate;
- use a secret manager/KMS instead of only a local encryption key;
- add server-side user sessions and CSRF protection;
- verify the Page allowlist and required Page tasks per Page;
- implement token expiry/revocation handling;
- connect the stored credentials to the guarded `publish_approved_post(post_job_id)` MCP tool.
