# Smart Parking Management System – Backend

REST API for the Smart Parking Management System (CSE410, Group 4).
Node.js + Express + MongoDB (Mongoose).

## Requirements

- Node.js 20 or newer (check with `node -v`)
- MongoDB running on your computer, **or** a free MongoDB Atlas database
  - **Windows:** download "MongoDB Community Server" from
    <https://www.mongodb.com/try/download/community> and install it with
    "Install MongoD as a Service" ticked, so it starts by itself.
  - **Mac:** `brew install mongodb/brew/mongodb-community`, then
    `brew services start mongodb-community`
  - **Atlas:** create a free cluster and put its connection string in `MONGO_URI` in `.env`

## Setup

Mac / Linux:

```bash
npm install
cp .env.example .env   # then edit MONGO_URI if you use Atlas
npm run dev            # restarts on file changes
```

Windows (Command Prompt or PowerShell):

```bat
npm install
copy .env.example .env
npm run dev
```

If you see `Could not connect to MongoDB`, MongoDB is not running
(see Requirements above).

Check that it works: <http://localhost:5050/api/health> should return
`{"status":"ok","database":"connected"}`.

## Scripts

| Command       | What it does                                         |
|---------------|------------------------------------------------------|
| `npm start`   | Start the API                                        |
| `npm run dev` | Start the API and restart it when a file changes     |
| `npm test`    | Run the tests (uses an in-memory MongoDB, not yours). New test files must be added to the "test" script in package.json |

The first `npm test` downloads a MongoDB binary (~70 MB) once.

## Folder structure

```
src/
  app.js            Express app: middleware + routes (no DB, used by tests)
  server.js         Connects to MongoDB and starts the server
  config/           env.js (settings from .env), db.js (Mongo connection)
  models/           Mongoose models (User, Account, ...)
  routes/           URL → controller mapping, mounted under /api
  controllers/      Request handlers
  middleware/       Error handling, auth guards (week 2)
  utils/            Small helpers
tests/              node:test + supertest
```

## Endpoints

| Method | Path          | Description                    |
|--------|---------------|--------------------------------|
| GET    | `/api/health` | API and database status        |

More endpoints follow each week (auth in week 2, spots in week 3).

## Models

**User** (the driver) – `userName`, `userCarNumber` (required, RQ02), `userPaymentMethod`, timestamps.

**Account** (login details) – `accountEmail` (unique, lower-case), `accountPasswordHash` (never returned),
`userID` or `administratorID`, timestamps.
