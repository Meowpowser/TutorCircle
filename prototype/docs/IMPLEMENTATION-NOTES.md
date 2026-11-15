# TutorCircle — Implementation Notes

How the project documents were used, what was missing or inconsistent, and which decisions were made where the documents were silent.

## 1. Documents reviewed

| Document | Found? | What it contributed |
|---|---|---|
| Assignment 1 (original functional requirements) | **Not in the folder** | Not available. Functional scope was taken from the feature list in the development brief, the Sprint 2 documents and the Figma screens. |
| Architecture Analysis Report.pdf | Yes (3 pages) | Layered Architecture with one modular backend; Group module holds the capacity and duplicate-membership rules; admin role check before approving tutors; chat access only for members/admins; Repository pattern for US‑04; Observer pattern for tutoring-request status (US‑08), including "if the save fails, keep the previous status and show an error". |
| Ethical Design Statement.pdf | Yes (2 pages) | Privacy (only verified AUBH accounts, role-limited features, private chats), fairness (match by course only, same approval process for all tutors, clear error messages), safety (admin review of reports, account management, no false success messages), trade-off (member names and student IDs visible to logged-in users). |
| SD10_TutorCircle.drawio | Yes | Contains **one page only**: "US‑04 Layered Sequence". |
| US04_Student_Join_Group_Sequence.png | Yes | Image export of the same US‑04 sequence diagram. |
| UML Class Diagram | **Not found** | The `.drawio` file has no class-diagram page. Classes were derived from the report and sequence diagram. |
| UML Component Diagram | **Not found** | No component-diagram page. Components follow the three layers named in the report. |
| Figma Link.txt → Figma file | Yes | Inspected the "Assignment 2 – High Fidelity" page in a browser without logging in (view-only). |

### Figma screens (page "Assignment 2 – High Fidelity", 50 frames of 1440×1024)

**Opened and studied individually (33):**

- **Login:** Login – Student, Login – Student (Error), Sign Up
- **Student:** Home, Group Details (Open / Full / Joined / Already a member), Needs Survey, Support Ticket, Support Ticket (Submitted), Find Tutors, Tutor Profile, Tutor Profile (Request Sent), My Groups, Group Chat (SWEN 360), Profile
- **Tutor:** Application, Home, Tutoring Requests (Pending), Availability, My Groups, Messages (COSC 102), Profile
- **Admin:** Dashboard, Tutor Approvals, Tutor Approval (Pending), Support Tickets, Ticket Details (Open), Manage Groups, Group Details, Users, User Details

**Seen only in the layer list / zoomed-out overview (17)** — these are state variants of the screens above, implemented by analogy: Login – Tutor, Login – Admin, Forgot Password, Forgot Password (Sent), Survey Submitted, Group Chat (COSC 102), Application Submitted, Tutoring Requests (Accepted / Declined), Availability (Saved), Messages (MATH 154 / DSAI 310), Tutor Approvals (Approved / Rejected), Tutor Approval (Approved / Rejected), Ticket Details (Resolved).

Most frames were viewed at reduced zoom, so exact pixel values (colours, font sizes, spacing) are close approximations, not values copied from Figma's inspect panel (which needs a Figma login). The file's "Page 1" and the "Components" section were not inspected in detail. Figma's prototype (play) mode requires a login and was not used.

## 2. Gaps and conflicts found

1. **Assignment 1, the UML Class Diagram and the UML Component Diagram are missing** from the workspace. Nothing was invented "from" them; the implementation follows the documents that exist.
2. **Two different user stories are both labelled "US‑04"** in the Architecture Report ("Join Tutoring Groups" and "Approve Tutor Applications"). Tutoring-request updates are labelled US‑08. The code comments use the labels exactly as the report does.
3. **`checkEligibility(studentId)` is not defined** in the sequence diagram. Assumption: a student is eligible when their account is **active** and has the **student** role (admins and deactivated accounts get `NOT_ELIGIBLE`).
4. **Closing a group** appears in Figma (Admin – Group Details: "Closing a group stops new students from joining") but not in the sequence diagram. Implemented as an extra `GROUP_CLOSED` check in the Group module before the capacity check; members are kept.
5. **Survey matching**: the Ethical Statement says course, confidence level and topics are collected and "only this information is used to match". The prototype recommends groups by **course only** (confidence and topics are saved for tutors/admins but never used to rank). This keeps matching identical for every student with the same course, as the fairness section requires.
6. **Tutors are also students** in Figma (a student applies from their profile or the login page). The data model therefore gives each user a list of roles (`['student', 'tutor']`), and the login tab chooses which interface to open. Approved tutors can switch views from the account menu.
7. **Database transaction / concurrency** (sequence diagram note) cannot exist in a browser-only app. `GroupRepository.tryAddMemberAtomically` re-reads, re-checks and writes once; this is safe within one tab but not across simultaneous tabs/devices. Documented in the README.
8. **Figma uses a Sunday–Thursday week** (AUBH teaching week); the availability grid and filters follow that.

## 3. Mapping the US‑04 sequence diagram to code

| Diagram step | Code |
|---|---|
| 1 `searchGroups(course)` | `studentHomePage` filter form (`presentation/pages/student.js`) |
| 2 `findGroups(course)` | `GroupService.findGroups()` |
| 3–4 `findByCourse(course)` | `GroupRepository.findByCourse()` |
| 6 `showNoGroupsFound()` / 7 `displayGroups()` | Empty state / card grid on Student Home |
| 8 `selectGroup` → 9 `getGroupDetails` | `openGroupDetails()` → `GroupService.getGroupDetails()` |
| 10 `findById`, 12 `countMembers` | `GroupRepository.findById()`, `GroupRepository.countMembers()` |
| 16 `clickJoinGroup` → 17 `joinGroup` | Join button → `GroupService.joinGroup(studentId, groupId)` |
| 18–20 `checkEligibility` / `NOT_ELIGIBLE` | `GroupService.checkEligibility()` |
| 21–24 `exists` / `ALREADY_MEMBER` | `GroupRepository.exists()` |
| 25–30 `getMaxCapacity`, `countMembers` / `GROUP_FULL` | `GroupRepository.getMaxCapacity()`, `countMembers()` |
| 31–32 `tryAddMemberAtomically` | `GroupRepository.tryAddMemberAtomically()` |
| 33–34 `JOINED(updatedCount)` | Success banner "You joined this group (N members now)" |
| 35–36 `joinFailure(status)` | Error banner with the message for that status |

## 4. Design patterns

- **Repository** — `src/data/repositories/`. Services ask repositories for data; only the storage adapter knows about `localStorage`. Swapping in a real API/database means writing a new adapter or repositories, without touching the business rules.
- **Observer** — `src/core/EventBus.js`. Services publish an event only **after** a successful save. On the Tutor Requests page the *status panel* and the *request list* are two separate subscribers to `requests:changed`. If saving fails, an error is thrown, nothing is published, and both keep showing the previous status. The same mechanism keeps sidebar badges, chat messages and other open tabs in sync.

## 5. Other implementation decisions

- Plain HTML/CSS/JavaScript ES modules, no framework or build step, so every student on the team can read and run it.
- Hash-based routing (`#/student/home`) so it works on any static server.
- All user-entered text is escaped before being shown (prevents script injection).
- Passwords are stored as salted SHA‑256 hashes (still demo-only, see README).
- Sessions are stored per tab (`sessionStorage`), data per browser (`localStorage`).
- Ticket numbers continue from the Figma examples (#1042 → new tickets get #1043, #1044 …).
- Features not in the documents (quizzes, study planners, payments, etc.) were deliberately **not** added. Small supporting additions: student "Edit profile" (for "profile management"), a "My tutoring requests" table so students can track request status, tutor "Create/Edit group" (for "manage tutoring groups"), and a "Reset demo data" button for testing.

## 6. Verification performed

- `npm run check` — all JavaScript files pass a syntax and import check.
- `npm test` — 27 automated business-logic tests pass.
- Manual browser testing (Chromium, desktop 1024 px and mobile 375 px): every Student, Tutor and Admin workflow in the README, form validation messages, persistence after refresh, capacity and duplicate rules, permission redirects, cross-tab updates, no horizontal scrolling on any page at 375 px, no console errors, and an automated scan confirming every visible button/link on every page has an action.
- Not verified: Safari and Firefox specifically; screen-reader testing; pixel-exact comparison with Figma's inspect values (needs a Figma login).
