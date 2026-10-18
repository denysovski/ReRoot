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

- **Monochrome.** Black, white and greys only. Light and dark themes are designed separately, plus an automatic mode.
- **Glass over soft light.** Translucent, blurred cards and menus float over slow-moving grey light. Data stays readable on top.
- **Apple-style fluid motion.** Every animation is a spring (response + damping), so it can be interrupted, reversed and grabbed mid-flight. Buttons react on pointer-down. The bottom sheet tracks your finger, rubber-bands at the edge and carries your release velocity into its closing animation.
- **One clear next step.** The positive action is always a **white pill with black text**. The negative or skip action is always **underlined text** below it ("Skip this step", "Not now").
- **Type.** [Geist](https://vercel.com/font) for everything, Geist Mono for numbers.
- **Reduced motion.** With "reduce motion" on, springs jump to their end state and decorative motion stops.

## Pages

| Public site | Account | App (logged in) |
| --- | --- | --- |
| `index.html` home with a 3D calendar | `register.html` | `app.html` with Home, Today, Progress, Goals, Read |
| `how-it-works.html` | `login.html` | Top-left **RE:ROOT** pill: main site, community chats, articles |
| `showcase.html` | `onboarding.html` (habits, goal, notifications, theme) | Top-right **log out** pill: theme, timezone, reminder, replay onboarding, log out |
| `community.html` | | |
| `articles.html`, `article.html?id=…` | | |
| `about.html`, `faq.html`, `contact.html` | | |
| `terms.html`, `privacy.html`, `404.html` | | |

The public pages use a centered, rounded navigation bar at 70% of the page width with a big footer. Once you log in, the navigation is replaced by two rounded corner buttons and a floating tab bar at the bottom.

## How the simulated accounts work

- `register` stores your name, email and a SHA-256 hash of your password in `localStorage` (`reroot.users`) and starts a session (`reroot.session`).
- `login` checks the hash. `logout` clears the session.
- Each user's habits and check-ins live under `reroot.data.<email>`.
- Clearing your browser's site data deletes everything.

## Project structure

```
index.html … 404.html      public pages, login, register, onboarding, app
assets/css/base.css         tokens, buttons, glass cards, nav, footer, menus
assets/css/pages.css        public pages, 3D calendar, auth, onboarding
assets/css/app.css          logged-in app
assets/js/core.js           springs, press feedback, theme, simulated auth, menus, toast
assets/js/site.js           nav, footer, reveal, word fill, 3D calendar, splash
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
python3 -m http.server 8000
# open http://localhost:8000
```

Notifications need a secure context, which `localhost` and GitHub Pages both provide.

## Disclaimer

Re:Root is a self-tracking tool, not medical care. If a habit is harming your health or you can't stop despite trying, talk to a doctor or therapist. In a crisis, contact your local emergency number.
