# SnapFind

> **Upload your event photos once. Take one selfie. Get every photo you're in.**

## Architecture

```
React + Vite + Tailwind  →  Node.js + Express  →  MongoDB Atlas (data + vectors)
                                    ↕
                             Python FastAPI (face detection + embeddings)
```

**Google Drive** stores original photos. **SnapFind** stores only metadata + face embeddings.

## Project Structure

```
snapfind/
├── client/          # React + Vite + Tailwind
├── server/          # Node.js + Express + MongoDB
├── face-service/    # Python + FastAPI + InsightFace
└── docker-compose.yml
```

## Setup

### Prerequisites
- Node.js 20+
- Python 3.10+
- MongoDB Atlas account (free M0 tier)
- Docker (optional, for face-service)

### Install

```bash
# Root dependencies
npm install

# Client + Server
npm run install:all

# Face service
cd face-service
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

### Configure

```bash
cp .env.example .env
# Fill in your MongoDB URI, JWT secret, etc.
```

### Run

```bash
# Terminal 1: Face service
cd face-service
uvicorn app.main:app --reload --port 8000

# Terminal 2: Client + Server
npm run dev
```

## Development Phases

1. ✅ Basic MERN (Auth, Rooms)
2. ✅ Local photo upload + face indexing
3. ✅ Selfie matching via vector search
4. 🔜 Google Drive integration
5. 🔜 Background processing (Redis + BullMQ)
6. 🔜 Optimization (pHash, quality, dedup)
7. 🔜 Production security
