# SnapFind — Walkthrough (Phases 0–3 Complete)

## End-to-End Test Results

All three core user flows have been verified in the browser:

### 1. Login / Registration
- ✅ Sign up with name, email, password
- ✅ JWT stored, user redirected to Home
- ✅ Duplicate email returns proper error

![Login Page](C:/Users/soham/.gemini/antigravity-ide/brain/a2051502-b19a-4ae9-9787-02ce69189cda/login_page_1786267247397.png)

---

### 2. Home Page
- ✅ Gradient hero text: "Find your photos with a single selfie"
- ✅ Create Room / Join Room action cards
- ✅ Your Rooms section with empty state
- ✅ User name + Logout in navbar

![Home Page](C:/Users/soham/.gemini/antigravity-ide/brain/a2051502-b19a-4ae9-9787-02ce69189cda/home_page_1786267327704.png)

---

### 3. Room Dashboard
- ✅ Room name, organization, description displayed
- ✅ 6-character room code with copy button (e.g. `YCU8WV`)
- ✅ Upload Photos card (owner only)
- ✅ Indexing progress component
- ✅ Delete Room option

![Room Dashboard](C:/Users/soham/.gemini/antigravity-ide/brain/a2051502-b19a-4ae9-9787-02ce69189cda/room_dashboard_1786267369536.png)

---

### 4. Full Flow Recording

![E2E Test Recording](C:/Users/soham/.gemini/antigravity-ide/brain/a2051502-b19a-4ae9-9787-02ce69189cda/e2e_test_flow_1786267221768.webp)

---

## Bugs Fixed During Testing

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `MONGODB_URI` not found | `.env` used `MONGO_URI`, server expected `MONGODB_URI` | [env.js](file:///c:/Users/soham/Documents/image-detection-system/server/src/config/env.js) now accepts both |
| `UnicodeEncodeError` in face service | Emoji chars in `print()` on Windows cp1252 terminal | Replaced emojis with `[INFO]`/`[WARNING]` prefixes |
| `numpy<2` build failure | Python 3.14 can't compile NumPy from source | Removed version pin, uses pre-built wheel |
| `timeout of 30000ms exceeded` during indexing | `FormData` boundary headers missing with `axios` | Switched to `form-data` package with `createReadStream` + `getHeaders()` |
| Duplicate Mongoose index warning | `code` field had both `unique: true` and `schema.index()` | Removed redundant `schema.index({ code: 1 })` |

---

## Architecture Summary

```
┌──────────────────────┐
│  React + Vite + TW4  │ ← Port 5173
│  6 pages, 5 components│
└──────────┬───────────┘
           │ /api (Vite proxy)
           ▼
┌──────────────────────┐
│  Node.js + Express   │ ← Port 5000
│  4 controllers       │
│  4 models            │
│  JWT + Cookies       │
└────┬───────────┬─────┘
     │           │
     ▼           ▼
┌─────────┐  ┌──────────────┐
│ MongoDB │  │ Python FastAPI│ ← Port 8000
│  Atlas  │  │ InsightFace  │
│         │  │ buffalo_l    │
│ Photos  │  │ 512-dim      │
│ Faces   │  │ ArcFace      │
│ Rooms   │  └──────────────┘
│ Users   │
│ Vector  │
│ Search  │
└─────────┘
```

---

## What's Next (Phase 4+)

| Phase | What to build |
|-------|--------------|
| **4** | Google Drive OAuth → folder selection → Drive-based indexing |
| **5** | Redis + BullMQ background workers |
| **6** | pHash deduplication, face quality filtering, lazy loading |
| **7** | Rate limiting, OAuth token encryption, consent flow, room expiry |
