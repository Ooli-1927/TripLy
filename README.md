# Triply

Explainable, situation-first destination recommendations for domestic travel in Bangladesh.

## Project structure

```
triply/
  frontend/               Vanilla UI (HTML, CSS, JS, assets, data)
  backend/                Express API + MongoDB Atlas
    .env                  Secrets (MONGODB_URI, JWT_SECRET) — not committed
    .env.example
    index.js
    routes/               auth + media (GridFS image URLs)
  tests/                  Engine / data unit tests
  package.json
```

## Setup

1. Create Atlas cluster and copy the connection string.
2. Copy env file and fill values:

```bash
copy backend\.env.example backend\.env
```

Edit `backend/.env`:

```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-long-random-secret
PORT=8000
```

3. Install and run:

```bash
npm install
npm start
```

Open [http://localhost:8000](http://localhost:8000).

The backend serves the frontend and the API on the same origin.

## Images (MongoDB URLs)

1. Place WebP files under `frontend/assets/img/<destination-id>/`  
   (`hero.webp`, `spot-1.webp` … `spot-4.webp`).
2. Seed into MongoDB GridFS:

```bash
npm run seed:images
```

3. The UI loads pictures from MongoDB-backed URLs, for example:

- `/api/media/dest/coxs-bazar/hero`
- `/api/media/dest/coxs-bazar/spot-1`
- `/api/media/avatar/<userId>`

Missing files fall back to motif SVGs.

## Auth

- Signup / login stored in MongoDB (`users` collection).
- Passwords are bcrypt-hashed on the server.
- Session cookie: httpOnly JWT (`triply_token`).

## Deploy (GitHub + Render)

1. Push this repo to GitHub.
2. On [Render](https://render.com), create a **Web Service** from the repo (or use Blueprint `render.yaml`).
3. Set environment variables:
   - `MONGODB_URI` — Atlas connection string (allow Render IPs / `0.0.0.0/0` in Atlas Network Access)
   - `JWT_SECRET` — long random string (or let Blueprint generate)
   - `NODE_ENV=production`
4. Build: `npm install --omit=dev` · Start: `npm start`
5. After first deploy, seed images once (local or Render shell) with `npm run seed:images` if GridFS is empty.

Health check: `GET /api/health`

## Tests

```bash
npm test
```
