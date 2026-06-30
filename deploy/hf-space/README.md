---
title: CineMatch API
emoji: 🎬
colorFrom: red
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# CineMatch API

FastAPI backend for **CineMatch** — a MovieLens movie recommender (10 models + a
Gemini conversational guide). This Space builds the `backend/` from
[github.com/jadzoghaib/Movie-RecSys](https://github.com/jadzoghaib/Movie-RecSys)
at Docker-build time.

The Next.js frontend is deployed separately (e.g. on Vercel) and points here via
its `NEXT_PUBLIC_API_BASE` environment variable.

## Environment variables to set on this Space (Settings → Variables and secrets)
- **`GEMINI_API_KEY`** *(secret)* — enables the AI Guide chat. Without it, the rest of the app still works.
- **`FRONTEND_ORIGIN`** *(variable)* — your frontend URL, added to CORS, e.g. `https://your-app.vercel.app`.

To pull the latest code after a GitHub push: **Settings → Factory rebuild**.
