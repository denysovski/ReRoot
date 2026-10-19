# Re:Root

**Pull the habit out by the root.**

Re:Root is a calm, black-and-white web app for quitting the habits you keep going back to: nail biting, masturbation and porn, smoking, late-night scrolling, or anything else. You check in once a day, watch your clean days stack up, and open a short guide when an urge hits.

**Live demo:** https://denysovski.github.io/ReRoot/

> This is a demo project. Accounts, notifications and community rooms are **simulated in the browser**. Nothing is sent to a server. Don't use a password you use anywhere else.

---

## The idea

Habits have roots: the time, place, feeling or person that sets them off. Re:Root keeps the daily routine tiny (one tap, an urge rating, a note) so you can keep it up for months, then shows you the pattern behind your slips so you can plan for those moments.

- **Daily check-in**: "Stayed clean" or "Slipped", an urge rating from 0 to 5 and a note about what helped. Missed a day? Fix it from the week row.
- **Goals and milestones**: a target streak per habit (7 to 365 days) and milestones at 1, 3, 7, 14, 30, 60, 90, 180 and 365 days.
- **Progress**: current and longest streak, clean-day rate, a streak-length line, urge bars and a 12-week calendar.
- **Read**: a 4-4-6 breathing exercise and short guides on urges, triggers, slips, environment and when to get help.
- **Community**: demo chat rooms per habit. Your own posts are saved locally.
- **Reminders**: real browser notifications (with your permission) at a time you choose.

## Style

- **Charcoal and white.** A near-black (#0f0f0f) background by default, white and greys on top. A light theme and an automatic mode are one tap away.
- **Cursor shine.** The background brightens softly around your pointer.
- **3D scenes.** A calendar, a stack of habits and a fan of phones float in 3D and tilt toward your mouse.
- **Glass over soft light.** Translucent, blurred cards and menus float over slow-moving grey light. Data stays readable on top.
- **Apple-style fluid motion.** Every animation is a spring (response + damping), so it can be interrupted, reversed and grabbed mid-flight. Buttons react on pointer-down. The bottom sheet tracks your finger, rubber-bands at the edge and carries your release velocity into its closing animation.
- **One clear next step.** The positive action is always a **white pill with black text**. The negative or skip action is always **underlined text** below it ("Skip this step", "Not now").
- **Type.** [Geist](https://vercel.com/font) for everything, Geist Mono for numbers.
- **Reduced motion.** With "reduce motion" on, springs jump to their end state and decorative motion stops.

## Pages and URLs

Re:Root is a **single-page app**: the site loads once, then every page swaps in instantly with a short transition. URLs are clean, with no `.html`:

| Public site | Account | App (logged in) |
| --- | --- | --- |
| `/` home with 3D calendar, 3D habit stack and 3D phones | `/register` | `/app` home, `/app/today`, `/app/progress`, `/app/goals`, `/app/read` |
| `/how-it-works` | `/login` | Top-left **RE:ROOT** pill: main site, community chats, articles |
| `/showcase` (every screen, explained) | `/onboarding` (habits, goal, notifications, theme) | Top-right **log out** pill: theme, timezone, reminder, replay onboarding, log out |
| `/community` | | |
| `/articles`, `/articles/<id>` | | |
| `/about`, `/faq`, `/contact` | | |
| `/terms`, `/privacy` | | |

The public pages use a centered, rounded navigation bar at 70% of the page width with a big footer. Once you log in, the navigation is replaced by two rounded corner buttons and a floating tab bar at the bottom.

**How clean URLs work on GitHub Pages:** GitHub Pages has no server-side routing, so opening `/ReRoot/about` directly serves `404.html`. That page stores the path and redirects to the app, which restores the URL with the History API and renders the right view. Links inside the site never reload the page.

## How the simulated accounts work

- `register` stores your name, email and a SHA-256 hash of your password in `localStorage` (`reroot.users`) and starts a session (`reroot.session`).
- `login` checks the hash. `logout` clears the session.
- Each user's habits and check-ins live under `reroot.data.<email>`.
- Clearing your browser's site data deletes everything.

## Project structure

```
index.html                  the single page: loads styles and scripts once
404.html                    GitHub Pages fallback that hands deep links to the app
serve.py                    local server that behaves like GitHub Pages
assets/css/base.css         tokens, buttons, glass cards, nav, footer, menus, cursor shine
assets/css/pages.css        public pages, 3D scenes, showcase, auth, onboarding
assets/css/app.css          logged-in app
assets/js/core.js           springs, press feedback, theme, simulated auth, menus, toast, shine
assets/js/views.js          HTML templates for every view
assets/js/spa.js            router: clean URLs, auth guards, transitions
assets/js/site.js           public layout, reveal, word fill, 3D scenes
assets/js/pages.js          behaviour for articles, community, contact, login, register
assets/js/data.js           guides shared by Articles and the Read tab
assets/js/store.js          per-user data and example history
assets/js/onboarding.js     onboarding flow (incl. Notification permission)
assets/js/app.js            the tracker
```

No framework and no build step. Plain HTML, CSS and JavaScript.

## Run locally

```bash
git clone https://github.com/denysovski/ReRoot.git
cd ReRoot
python3 serve.py
# open http://localhost:8000
```

Notifications need a secure context, which `localhost` and GitHub Pages both provide.

## Disclaimer

Re:Root is a self-tracking tool, not medical care. If a habit is harming your health or you can't stop despite trying, talk to a doctor or therapist. In a crisis, contact your local emergency number.
