# CLIB — Handball Team Management

CLIB is an Arabic-language web application for managing team rosters, attendance, player profiles, and live handball matches. It uses server-rendered EJS pages, an Express server, Firebase Authentication, and Cloud Firestore.

Some package metadata, page titles, and upload configuration still use older football terminology. This guide describes the current application in `server.js`.

## Features

- Player profiles with shirt numbers, positions, physical measurements, sports tests, and coach notes.
- Age-group rosters and CSV export.
- Attendance entry, history, editing, and deletion.
- Administrator, coach, viewer, and linked player accounts.
- Interactive court tracking, full-match tracking, and individual player statistics.
- Match reports, a statistics dashboard, and public live-score pages.

Category identifiers are `under14`, `under16`, `under18`, `under20`, and `man`. Some player forms currently list only the first three categories. Player positions are stored as `court` or `goalkeeper`.

## Local setup

### 1. Install dependencies

Use Node.js 22 or later and npm. The installed Firebase Admin dependency requires Node.js `>=22`; the separate Functions scaffold specifies Node.js 24.

From the repository root:

```powershell
npm ci
```

There is no frontend compilation step. The generated package under `src/dataconnect-generated` must remain present because `package.json` references it as a local dependency.

### 2. Configure Firebase

Use a Firebase project with Email/Password Authentication enabled and a Cloud Firestore database in Native mode. The browser and server must use the same Firebase project.

Create a service-account JSON key and store it outside the repository. Create a local `.env` file with these values, replacing the placeholders:

```dotenv
PORT=4000
NODE_ENV=development
SESSION_SECRET=replace-with-a-long-random-value
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_DATABASE_ID=(default)
GOOGLE_APPLICATION_CREDENTIALS=C:/secure/firebase-service-account.json
```

`GOOGLE_APPLICATION_CREDENTIALS` is a file path, not the private key itself. If the Firestore database is named, set `FIREBASE_DATABASE_ID` to its exact name instead of `(default)`.

Alternatively, omit `GOOGLE_APPLICATION_CREDENTIALS` and configure inline credentials:

```dotenv
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_CONTENT\n-----END PRIVATE KEY-----\n"
```

The server prefers inline credentials when both the email and private key are set. Its sign-up configuration check recognizes inline credentials or an existing service-account file; other Application Default Credentials arrangements are not recognized by that check.

Update the browser Firebase configuration in all three locations when changing projects:

- `config/firebase-client-config.js`
- `views/auth/sign-in.ejs`
- `views/auth/sign-up-success.ejs`

The views currently contain their own configuration copies. Editing the config module alone does not update them. Login translates a username into an email using the synthetic domain `handball-app.local`; keep that convention consistent across account creation and the browser views.

The repository's `firestore.rules` denies direct client reads and writes. Application data access goes through the server's Admin SDK. Configure the indexes listed in `firestore.indexes.json` in the selected database:

| Collection | Fields |
| --- | --- |
| `players` | `category` ascending, `name` ascending |
| `attendance` | `player` ascending, `date` descending |

If an additional query reports a missing index, use the index definition identified by that error for the correct database. This checkout does not contain a root `firebase.json` deployment configuration.

### 3. Start the application

```powershell
npm start
```

Open <http://localhost:4000>. Set `PORT` to use another port. Restart the process after editing server code or environment variables; no watch script is configured.

### 4. Create the first administrator

1. Register at `/auth/sign-up`.
2. Locate the account's UID in Firebase Authentication.
3. In the configured Firestore database, open `users/<uid>` and change `isAdmin` to boolean `true`.
4. Reload the application and open `/admin/players`.
5. Use `/admin/add-admin` to create subsequent administrator or coach accounts.

The application reads role flags from the Firestore user document on each authenticated request. Do not use `setupAdmins.js`: it belongs to the older MongoDB implementation and depends on packages and a model that are absent from this application.

### Other environment variables

| Variable | Purpose / default |
| --- | --- |
| `PORT` | HTTP port; defaults to `4000`. |
| `NODE_ENV` | `production` enables secure session cookies; use HTTPS in that environment. |
| `SESSION_SECRET` | Secret for Express flash-message sessions; code falls back to `default_secret` if omitted. |
| `FIREBASE_PROJECT_ID` | Server project ID; code falls back to `club-54d21`. Set explicitly for your project. |
| `FIREBASE_DATABASE_ID` | Firestore database ID; defaults to `(default)`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the service-account JSON file. |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Alternative inline service-account credentials. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary configuration in `server.js`. The configured upload middleware is not currently attached to a route. |

The existing `.gitignore` excludes `.env` and `node_modules`. Keep service-account files outside the repository; arbitrary JSON credential files are not excluded by that rule.

## Using the application

1. Sign in at `/auth/sign-in`.
2. Add players at `/listings/new` and browse a roster such as `/listings/under16`.
3. Record attendance at `/attendance/under16` and inspect a player's attendance history from their profile.
4. As an administrator, create player login accounts at `/admin/create-player-account`, linking each to an existing player. The form prevents linking a second account to the same player.
5. As an administrator or coach, open `/match-live` to select a roster and record a match, or `/court` for the court dashboard.
6. Review matches at `/match-live/reports/list` and overall statistics at `/statistics`.
7. Share `/match-live/score/<match-id>` for public score viewing.

## Architecture

```text
Browser (EJS pages + JavaScript)
  |-- Firebase client Auth: username/password sign-in
  |-- POST /auth/session-login: exchange ID token for session cookie
  `-- Express routes: authenticated pages and JSON requests
        |-- Middleware: verify cookie, load user and linked player
        |-- Controllers: roster, attendance, events, statistics
        `-- Firebase Admin SDK: Authentication + Firestore
```

The Firebase `session` cookie lasts five days and is HTTP-only. `middleware/attach-user.js` verifies it with revocation checking and loads the matching `users` document. Express sessions are used separately for temporary flash messages, not for authenticated identity. Sign-out clears the Firebase session cookie and revokes the account's refresh tokens.

| Path | Responsibility |
| --- | --- |
| `server.js` | Express startup, middleware, route mounting, and error pages. |
| `config/` | Firebase Admin initialization, browser config, timestamp conversion helpers. |
| `controllers/` | Authentication, account management, players, attendance, events, and statistics. |
| `routes/` | Active individual statistics routes and match page routes. |
| `middleware/` | Authentication, role checks, and view locals. |
| `views/` | EJS layouts, pages, forms, and partials. |
| `public/` | CSS, browser JavaScript, court images, and logo assets. |
| `firestore.rules`, `firestore.indexes.json` | Firestore access-rule and index definitions. |
| `functions/` | Separate TypeScript Firebase Functions scaffold; it does not export the Express app. |
| `dataconnect/`, `src/dataconnect-generated/` | Movie-review example schema and generated SDK; not the active team data layer. |

`routes/game-stats.js` uses `controllers/game-stats-controller.js`. The similarly named `controllers/gameStats.js` is not mounted by `server.js`.

## Data model

Firestore is schemaless; the controllers define the effective document structure.

| Collection | Main contents and relationships |
| --- | --- |
| `users` | Document ID is the Firebase Auth UID. Contains `username`, role flags (`isAdmin`, `isCoach`, `isView`), `isPlayer` (a player ID or null), and `createdAt`. |
| `players` | Name, category, height, weight, phone number, shirt number, position, sports tests, and coach notes. |
| `attendance` | `player` references a player ID; includes status, comment, date, and creation time. |
| `matches` | Team names, match name, period, status, clock state, roster, starting lineup, timestamps, and `eventIds`. |
| `events` | Individual match/court events, optional `matchId`, player references, event type/result, and location or timing fields. |
| `gameStats` | Per-player aggregates and event details keyed by player plus match ID or draft match name. |

The `/events` and `/game-stats/event` endpoints write separate representations. A call to `/events` does not automatically update `gameStats`; integrations must account for the two flows. Likewise, aggregate deletion is separate from match/event deletion.

## Routes and access

“Signed in” below means the server has successfully loaded the user's Firestore profile. Team management routes require `isAdmin` or `isCoach`.

| Method and route | Purpose | Access |
| --- | --- | --- |
| `GET /` | Home | Public |
| `GET/POST /auth/sign-up` | Registration | Public |
| `GET /auth/sign-in` | Login form | Public |
| `POST /auth/session-login` | Exchange `{ idToken }` for cookie | Valid Firebase ID token |
| `GET /auth/sign-out` | Logout | Public |
| `GET /admin/players` | Players and linked accounts | Administrator |
| `GET/POST /admin/add-admin` | Create administrator or coach | Administrator |
| `GET/POST /admin/create-player-account` | Link a new account to a player | Administrator |
| `GET /listings/:category` | Roster | Signed in |
| `GET /listings/profile/:id` | Player profile | Signed in |
| `GET /listings/export?category=under16` | Roster CSV | Signed in |
| `GET /listings/new`, `POST /listings` | Create player | Signed in |
| `GET /listings/:id/edit`, `PUT/DELETE /listings/:id` | Edit/delete player | Signed in |
| `POST /listings/profile/:id/notes` | Add coach note | Administrator or coach |
| `GET /attendance/:category`, `POST /attendance` | Attendance form and submission | Signed in |
| `GET /attendance/player/:id` | Player attendance history | Administrator, viewer, or linked player |
| `GET /attendance/:id/edit`, `PUT/DELETE /attendance/:id` | Edit/delete attendance | Signed in |
| `GET /players` | Player list JSON | Signed in |
| `GET /player-categories` | Category identifiers JSON | Public |
| `GET /court`, `GET /match-live` | Match tracking pages | Administrator or coach |
| `POST /events`, `DELETE /events/:id`, `DELETE /events` | Add/remove events; bulk deletion clears unassigned events | Administrator or coach |
| `GET /stats` | Event statistics; optional `matchId` query | Signed in |
| `POST /matches`, `PUT/DELETE /matches/:id` | Create/update/delete matches | Administrator or coach |
| `GET /matches`, `GET /matches/:id` | Match JSON | Signed in |
| `GET /public/matches/:id` | Public match JSON | Public |
| `GET /match-live/reports/list`, `GET /match-live/reports/:id` | Reports | Signed in |
| `GET /match-live/score/:id` | Live score page | Public |
| `GET /game-stats/live/:playerId` | Individual live tracking | Administrator or coach |
| `POST /game-stats/event`, `DELETE /game-stats/:gameStatsId` | Update/delete aggregates | Administrator or coach |
| `GET /game-stats/player/:playerId` | Player aggregate JSON | Signed in |
| `GET /statistics` | Statistics dashboard | Signed in |

HTML forms use the `_method` query parameter for PUT and DELETE requests. Unauthenticated protected requests generally redirect to `/auth/sign-in` rather than returning a JSON 401.

Role enforcement is not uniform: player and attendance modification routes currently require only sign-in. The `isView` flag does not enforce a global read-only restriction. The table reflects server checks rather than navigation visibility.

### Individual statistics request example

Send this JSON to `POST /game-stats/event` with an administrator or coach session:

```json
{
  "playerId": "PLAYER_DOCUMENT_ID",
  "player": "Player name",
  "matchId": "MATCH_DOCUMENT_ID",
  "type": "shot6m",
  "result": "goal",
  "shotLocation": "50,30",
  "goalDirection": "top-left",
  "period": "1",
  "time": "05:12"
}
```

This endpoint requires `playerId` and `type`. Its shot counter types are `shot6m`, `shot7m`, `shot9m`, `shotWing`, `shotFastBreak`, and `shotOrganized`; it also counts saves, turnovers, fouls, steals, suspensions, and passes. `/stats` uses the separate event collection and checks `type: "shot"` for its shot count, so the two formats are not interchangeable.

## Verification and troubleshooting

The root package has no automated test suite: `npm test` intentionally exits with “no test specified.” For a configured development Firebase project, manually verify registration/sign-in, player creation, attendance entry, match tracking, report rendering, public score access, and sign-out. These checks write real data to the configured database.

| Symptom | What to check |
| --- | --- |
| Sign-up reports missing Firebase credentials | Confirm the service-account file exists or both inline credential variables are set. |
| Firestore `NOT_FOUND` | Confirm project ID, database ID, database creation, and service-account project. |
| `auth/configuration-not-found` | Check that Authentication and Email/Password sign-in are enabled. |
| Index error when loading a roster/history | Configure the required composite index in the selected database. |
| Login succeeds in Firebase but application redirects to login | Check server credentials, the `users/<uid>` document, cookie handling, and matching browser/server projects. |
| Cookie does not persist over local HTTP | Use `NODE_ENV=development`; production cookies require HTTPS. |
| `/auth` fails to render | That route references an absent `home.ejs`; use `/` or `/auth/sign-in`. |

No deployment target is configured in this guide. The runnable application is the root Node process; the Functions scaffold is not a deployment wrapper for it. This documentation was checked against repository source; it does not imply that Firebase-dependent workflows have been executed.
