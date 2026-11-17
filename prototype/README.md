# TutorCircle

A peer-tutoring and study-group website for AUBH students — SWEN 360 (Software Design and Engineering) team project.

This is a **working, browser-based prototype** built with plain HTML, CSS and JavaScript (no frameworks, no npm packages). It follows the team's **Layered Architecture** decision, uses the **Repository** and **Observer** patterns from the Architecture Analysis Report, implements the **US‑04 sequence diagram** step by step, and reproduces the **Figma "Assignment 2 – High Fidelity"** screens for Students, Tutors and Admins.

> ⚠️ **Prototype only.** AUBH sign-in, secure multi-user authorization, real-time messaging and database concurrency are **simulated** (see [Limitations](#limitations)). Do not use real passwords or personal data.

---

## 1. Requirements

- **Node.js 18 or newer** (check with `node -v`). Nothing else — there are no dependencies to install.
- A modern browser (Chrome, Safari, Edge or Firefox).

## 2. Run the website

From inside this folder:

```bash
npm start
```

Then open **http://localhost:5173** in your browser. Press `Ctrl + C` in the terminal to stop the server.

- Use another port: `PORT=8080 npm start`
- No Node? Python works too: `python3 -m http.server 5173` (then open http://localhost:5173)

> The site must be opened through `http://localhost`, **not** by double-clicking `index.html`. Browsers block JavaScript modules and secure hashing on `file://` pages.

`npm install` is **not** needed (the project has no dependencies), but running it is harmless.

## 3. Demo accounts

All accounts are fictional. The login page also lists them with a **Use** button that fills the form.

| Role | Login tab | Email | Password |
|---|---|---|---|
| Student | Student | `f2400229@aubh.edu.bh` (Helena Azuela) | `Student123!` |
| Tutor | Tutor | `f2400084@aubh.edu.bh` (Maryam AlBastaki) | `Tutor123!` |
| Admin | Admin | `admin@aubh.edu.bh` (Layla Hassan) | `Admin123!` |
| Any other demo user | Student/Tutor | e.g. `f2409101@aubh.edu.bh` (Noor Khalil) | `Demo123!` |

`f2409102@aubh.edu.bh` (Hamad Ali) is **deactivated** on purpose, to show the "account deactivated" error.

**Reset demo data:** on the login page, click **Reset demo data** to restore the original data (this clears everything you changed in this browser).

**Tip — test two roles at once:** each browser tab keeps its own login, but data is shared. Log in as the tutor in one tab and the student in another; changes (requests, chat messages, group joins) appear in the other tab without refreshing.

## 4. How to test each role

### Student (Helena)
1. **Search and filter groups** — Home → choose *SWEN 360* in "All courses" → **Apply filters**. Try *Any availability* (day) and *Any time* too; **Reset** clears them.
2. **Join a group (US‑04)** — click **View details** on *Software Design and Engineering* → **Join Group**. The capacity changes from *4 of 6* to *5 of 6* and you appear in the member list.
3. **Persistence** — refresh the page, open **My Groups**: the group is still there.
4. **Duplicate membership** — open the same group again: "You're already a member of this group" and **Open chat** instead of Join.
5. **Full group** — open *Principles of Physics I* (6 of 6): "This group is full…" and the Join button is disabled.
6. **Group chat** — My Groups → **Open chat** → send a message. Chats of groups you are not in cannot be opened (try `#/student/chat/grp-math260`).
7. **Find tutors** — Find Tutors → filter by course/day/method → **View profile** → choose a course and time → **Send request**. Leave fields empty first to see validation.
8. **Needs survey** — Survey → submit empty to see errors → answer all 3 questions → submitted page shows groups for that course.
9. **Support ticket** — Support Ticket → submit empty to see errors → fill it in → *Ticket #1043 submitted*. Click a ticket in **My tickets** to see its status and the admin's response.
10. **Profile** — Profile → **Edit profile** (name/major/year). **View tutor application** shows Helena's pending application.

### Tutor (Maryam)
1. **Home** — pending-request banner, course cards with the next session, upcoming sessions table.
2. **Requests (Observer pattern, US‑08)** — Requests → **Accept** or **Decline**. The tab counts (status panel), the list and the sidebar badge all update together from the same saved data.
3. **Availability** — toggle time slots and the session method → **Save availability** → refresh to confirm it was saved. Turning every slot off and saving shows an error.
4. **My Groups** — **Create group** (try submitting empty first), **Edit**, **Members** → **Remove** a student, **Message** opens the group chat.
5. **Messages** — chat with each group you tutor.
6. **Profile** — change the courses you tutor / experience → **Save changes**.

### Admin (Layla)
1. **Dashboard** — counters, pending approvals, recent tickets, users/groups overview.
2. **Tutor approvals** — Review *Helena Azuela* → **Approve application**. Then log in as Helena on the **Tutor** tab — it now works, and she appears in *Find Tutors*. Rejecting requires a note.
3. **Support tickets** — open a ticket → add a note → **Mark as in progress** / **Mark as resolved** (or choose a status and **Save status**). The student sees the new status and note.
4. **Manage groups** — filter by course/status → **Manage** → remove members, **Close group** (students can no longer join), **Edit group details**, **Open group chat** (authorized admin access).
5. **Users** — tabs by role → **Manage** → change role or **Deactivate account**. A deactivated user can no longer log in or join groups. Admins cannot deactivate themselves.

### Permission checks
- Logged out, open `http://localhost:5173/#/admin/users` → you are sent to the login page.
- As a student, open `#/admin/dashboard` → "You don't have permission to open that page."
- The business services re-check every permission, so hiding a button is never the only protection.

## 5. Automated tests

```bash
npm test          # 27 business-logic tests (Node's built-in test runner)
npm run check     # syntax + import check for every JavaScript file
```

The tests run the real Business and Data layers against in-memory storage. They cover the whole US‑04 sequence (search, details, join, duplicate, full, last spot, closed group, failed save), the US‑08 Observer behaviour (both subscribers notified; nothing published when a save fails), tutor approval, tickets, login/sign-up validation, chat privacy, the survey and admin account management.

## 6. Project structure (Layered Architecture)

```
TutorCircle/
├── index.html                  Single page that loads the app
├── server.js                   Tiny local web server (no dependencies)
├── package.json                npm start / npm test / npm run check
├── assets/
│   ├── css/styles.css          Design system based on the Figma file
│   └── favicon.svg
├── src/
│   ├── app.js                  Entry point: wires the layers + routes
│   ├── core/                   Shared helpers used by all layers
│   │   ├── EventBus.js         Observer pattern (publish / subscribe)
│   │   ├── errors.js           Error codes (NOT_ELIGIBLE, GROUP_FULL, …)
│   │   ├── crypto.js           Demo password hashing
│   │   └── time.js             Schedules, dates, availability slots
│   ├── presentation/           ── PRESENTATION LAYER ──
│   │   ├── router.js           Hash routes + role guard
│   │   ├── ui/                 Layout shell, components, icons, DOM helpers
│   │   └── pages/              auth, student, tutor, admin, chat, search, dialogs
│   ├── business/               ── BUSINESS LOGIC LAYER ──
│   │   ├── AuthService.js      Login, sign-up, sessions, role switching
│   │   ├── PermissionService.js  Single place for role / membership rules
│   │   ├── GroupService.js     "Group Module": search, details, join rules, manage groups
│   │   ├── TutorService.js     Applications, approvals, tutor profiles, availability
│   │   ├── RequestService.js   Tutoring requests (US‑08)
│   │   ├── TicketService.js    Support tickets
│   │   ├── ChatService.js      Private group chat
│   │   ├── SurveyService.js    Student Needs Survey
│   │   ├── UserService.js      Profiles + admin account management
│   │   ├── ScheduleService.js  Upcoming sessions
│   │   └── validation.js       Input validation rules
│   └── data/                   ── DATA LAYER ──
│       ├── storage.js          localStorage / in-memory adapters
│       ├── seed.js             Fictional demo data
│       └── repositories/       Repository pattern (GroupRepository = "Group Repository")
├── tests/                      Automated tests
├── scripts/check-syntax.js     Syntax/import checker
└── docs/IMPLEMENTATION-NOTES.md  Document review, assumptions, gaps and conflicts
```

Rule of the layers: **pages → services → repositories → storage**. Pages never read storage directly, and services never touch the DOM.

## 7. Limitations

This prototype runs entirely in the browser. The following are **simulated or not available**:

| Area | What the prototype does | What a real system needs |
|---|---|---|
| AUBH authentication | Checks the email ends in `@aubh.edu.bh` and compares a salted SHA‑256 hash stored in **this browser's** localStorage. Password reset only shows a message — no email is sent. | AUBH single sign-on / a server-side identity provider. |
| Authorization | Role and membership rules are enforced in the Business Logic Layer, but all code and data are in the user's browser, so a technical user could edit localStorage. | Server-side checks on every request. |
| Multi-user data | Each browser has its own copy of the data. Other computers never see your changes. | A shared backend and database. |
| Real-time chat | Messages appear instantly in **other tabs of the same browser** (via the `storage` event). No delivery between devices. | WebSockets or a messaging service. |
| Concurrency | `tryAddMemberAtomically` re-checks capacity and duplicates before one write, which is safe within a tab. Two tabs clicking at the exact same moment are not protected. | A database transaction with concurrency control (as described in the sequence diagram note). |
| Notifications | Status changes are shown on screen (badges, ticket status). No email/push notifications. | Notification service. |

No production-level security is claimed.

## 8. Uploading to GitHub later

Commit **everything in this folder except** what `.gitignore` excludes. In practice that means:

- `index.html`, `server.js`, `package.json`, `README.md`, `.gitignore`
- `assets/`, `src/`, `tests/`, `scripts/`, `docs/`
- Your assignment documents (PDFs, `.drawio`, `.png`, `Figma Link.txt`) — optional; include them if the repository should hold the project documentation too.

There is no `node_modules/` folder and no build step, so the repository will run with `npm start` right after cloning.
