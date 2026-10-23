# Smart Parking Management System – F2026_Group4

CSE410 Software Engineering II, European University Cyprus.

## Team

| Member | Role | GitHub ID |
|---|---|---|
| <Name> | Member 1 – Frontend (design system, map, reservation flow, reports UI) | <id> |
| <Name> | Member 2 – Frontend (layouts, payment UI, profile, accessibility) | <id> |
| <Name> | Member 3 – Backend (auth, spots API, reservations, admin API) | giorgos1990 |
| <Name> | Member 4 – Backend (sensors/MQTT, payments, violations, load tests) | <id> |
| <Name> | Member 5 – Full-stack (admin dashboard, SSE stream, profile + reports APIs, QA) | michaelAk-hub |

## Tech stack

- **Frontend:** HTML, CSS, JavaScript (no framework), Fetch API, EventSource, Chart.js
- **Backend:** Node.js + Express.js, JWT, bcrypt, helmet, express-rate-limit
- **Database:** MongoDB + Mongoose
- **Sensors:** ESP32 simulated by a Node script, Mosquitto MQTT broker, mqtt.js
- **Testing:** Jest, Supertest, Postman/Newman, autocannon or k6, Lighthouse

## Repository structure

```
frontend/    HTML/CSS/JS client
backend/     Node.js + Express API
  src/
    config/       environment settings (env.js) and database connection (db.js)
    models/       Mongoose models (User, Account, ...)
    routes/       API routes (all under /api)
    controllers/  request handlers
    middleware/   error handler and other middleware
    utils/        helper functions
    app.js        Express app
    server.js     entry point: checks settings, connects to MongoDB, starts the API
  tests/     Jest tests
simulator/   ESP32 sensor simulator (MQTT)
docs/        report, diagrams
.github/     CI workflow, PR and issue templates
```

## Getting started

1. Install Node.js 20+, MongoDB and Mosquitto.
2. Install the backend dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Create your local environment file and fill in the values:
   ```bash
   cp .env.example .env
   ```
   `.env` holds secrets and is git-ignored. Never commit it.
4. Start the API (MongoDB must be running):
   ```bash
   npm start        # or: npm run dev  (restarts on file changes)
   ```
   Check it works: open http://localhost:3000/api/health. It returns `{"status":"ok","database":"connected"}`.
5. Run the tests:
   ```bash
   npm test
   ```
   The tests use a temporary in-memory MongoDB (`mongodb-memory-server`), so they don't need your local database. The first run downloads MongoDB, so it needs internet and can take a minute.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | yes | Port the API listens on (1–65535) |
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Secret for signing JWTs (at least 32 characters) |
| `MQTT_URL` | yes | Mosquitto broker URL |
| `NODE_ENV` | no | `development` (default) or `production` |
| `JWT_EXPIRES_IN` | no | Token lifetime, default `1h` |

The backend validates these at startup (`backend/src/config/env.js`) and stops with a clear error if one is missing or invalid.

## Branching and commit rules

The instructor only accepts commits that are on `main`, so everyone commits directly to `main`. There is no `dev` branch.

Before you push, follow these 3 rules so `main` keeps working:

1. **Sync before you start working:** `git pull origin main`
2. **Run the tests before you push:** `cd backend && npm test`. Only push if everything passes.
3. **Only commit your own files:** add files by name (`git add path/to/file`), not `git add .`, and never edit or delete a teammate's files without asking them.

Typical workflow:

```bash
git pull origin main
# ... make your changes ...
cd backend && npm test && cd ..
git add <your files>
git commit -m "feat(scope): what changed"
git pull origin main   # get teammates' latest work before pushing
git push origin main
```

- If you already have work on a `feature/...` branch, merge it into `main` (`git checkout main && git pull && git merge feature/<branch> && git push origin main`).
- Commit messages: `type(scope): what changed` (`feat`, `fix`, `test`, `docs`, `chore`).
- Each member's essential weekly commit is on `main` by Sunday 23:59.
- GitHub Actions runs the tests on every push to `main`; fix a red ✗ straight away.
- Track tasks on the GitHub Projects board.
