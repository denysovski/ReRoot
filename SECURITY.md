# Security

Re:Root is a static website. It runs entirely in the browser and is hosted on GitHub Pages.
There is **no backend server, no database and no API**. Nothing you log ever leaves your browser.

## What this means

| Risk | Status |
| --- | --- |
| SQL injection | Not possible. There is no database or server-side code to inject into. |
| Reading other users' data | Not possible over the network. Each person's data is stored only in their own browser (`localStorage`), keyed by account. |
| Server overload / DDoS | Pages are static files served by GitHub's CDN, which absorbs traffic spikes and rate-limits abuse. There is no app server to crash. |
| Cross-site scripting (XSS) | Everything a user types (habit names, notes, diary) is escaped before it is shown. A strict Content-Security-Policy blocks injected and third-party scripts. |
| Clickjacking | Blocked by `X-Frame-Options: DENY` / `frame-ancestors 'none'` on hosts that send headers (see below). |
| Password storage | PBKDF2-SHA256, 210,000 iterations, random salt per account. Older hashes are upgraded on the next login. |
| Password guessing | After 5 wrong attempts the login locks for 30 seconds, doubling up to 5 minutes. Error messages don't reveal whether an email exists. |

## Headers

Every page carries a Content-Security-Policy and Referrer-Policy as `<meta>` tags, because GitHub Pages does not allow custom HTTP headers.
The full header set (HSTS, X-Content-Type-Options, X-Frame-Options, Permissions-Policy, COOP, CSP with `frame-ancestors`) is in [`_headers`](./_headers).
It is applied automatically when the site is hosted on Netlify or Cloudflare Pages, or when Cloudflare is put in front of GitHub Pages.
`serve.py` sends the same headers during local development.

## Accounts are a demo

Log in and registration are simulated: accounts live in the browser that created them. Anyone with access to that browser profile can read its local data.
A production version would need a real backend with server-side authentication, rate limiting and parameterised database queries.

## Reporting a problem

Please open an issue on GitHub describing the problem. Do not include personal data.
