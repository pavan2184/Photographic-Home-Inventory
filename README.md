# Home Inventory

AI-powered home inventory management app. Photograph your belongings, let AI identify them, and track their value over time.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python 3.12) |
| Database / Auth / Storage | Supabase (PostgreSQL + Auth + Storage) |
| AI Vision & Valuation | Google Gemini 2.5 Flash |
| Mobile | React Native / Expo |
| Deployment | Docker Compose |

## Features

- **AI Item Detection** — Photograph an item and Gemini identifies the name, category, brand, and confidence score. Results are suggestions only; the user confirms before saving.
- **Smart Valuation** — Each item gets a resale value estimate using AI or a category-based depreciation model (declining-balance). A stability layer prevents erratic value swings between updates.
- **Portfolio Dashboard** — Aggregated view of total inventory value, depreciation trends, and per-item value changes.
- **Secure Multi-User** — Supabase Auth with JWT tokens. Row-Level Security (RLS) policies ensure users only see their own data.
- **Flexible Metadata** — Add custom key-value pairs (serial numbers, warranty info, location) to any item.

## Architecture

```
frontend/                       backend/
  screens/                        routers/
    CameraScreen ─── photo ───►     /upload    → Supabase Storage
    DetectScreen ─── image_url ──►  /items/detect → Gemini Vision API
    HomeScreen ─── CRUD ──────────► /items      → Supabase DB
    ItemDetailScreen ── valuation ► /items/{id}/valuation → Valuation Service
    DashboardScreen ── summary ──► /assets/summary → Aggregation
```

### Valuation Pipeline

Raw valuation is computed via two methods (AI first, depreciation fallback), then passed through a **stability layer**:

1. **AI Resale Estimate** — Gemini estimates resale value given item details. Discarded if confidence < 0.5.
2. **Depreciation Fallback** — `value = purchase_price * (1 - rate) ^ years_owned`. Rates vary by category (Electronics 25%, Furniture 10%, Clothing 40%, etc.).
3. **Stability Layer** (`compute_stable_value`) applies four guardrails:
   - **Fallback gate** — Discard low-confidence AI results for existing items
   - **Change clamp** — Max change limited to `confidence * 10%` of current value
   - **Blended update** — `70% old + 30% new` weighted average
   - **Anchor constraints** — Final value clamped to `[20%, 110%]` of purchase price
4. **30-day cooldown** — Cached value is returned on page loads. Bypass with "Recalculate Value" button or by changing purchase info.

## Project Structure

```
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, router registration
│   │   ├── config.py            # Environment config (pydantic-settings)
│   │   ├── auth.py              # JWT verification (Supabase tokens)
│   │   ├── database.py          # Supabase client init
│   │   ├── models.py            # Pydantic request/response schemas
│   │   ├── routers/
│   │   │   ├── items.py         # Items CRUD, detection, valuation endpoints
│   │   │   ├── upload.py        # Signed upload URL generation
│   │   │   └── assets.py        # Portfolio summary endpoint
│   │   └── services/
│   │       ├── vision.py        # Gemini AI item detection
│   │       └── valuation.py     # AI + depreciation valuation + stability layer
│   └── migrations/
│       ├── 001_create_items_table.sql
│       ├── 002_add_valuation_columns.sql
│       ├── 003_add_previous_value.sql
│       └── 004_create_valuation_history.sql
└── frontend/
    ├── Dockerfile
    ├── App.js                    # Navigation stack
    └── src/
        ├── config.js             # API URL, Supabase config
        ├── context/AuthContext.js # Global auth state
        ├── lib/
        │   ├── supabase.js       # Supabase client
        │   └── api.js            # Backend API wrapper
        └── screens/
            ├── LoginScreen.js    # Sign in / sign up
            ├── HomeScreen.js     # Item list with search
            ├── CameraScreen.js   # Camera / photo picker
            ├── DetectScreen.js   # AI detection confirmation
            ├── ItemDetailScreen.js # Item details + valuation + metadata
            └── DashboardScreen.js  # Portfolio overview
```

## Setup

### Prerequisites

- Docker & Docker Compose
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini)

### 1. Configure environment

```bash
cp backend/.env.example backend/.env
```

Fill in your credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-publishable-key
SUPABASE_SERVICE_KEY=your-secret-service-key
SUPABASE_JWT_SECRET=your-jwt-secret
GEMINI_API_KEY=your-gemini-api-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081
CONFIDENCE_THRESHOLD=0.5
STORAGE_BUCKET=item-images
```

### 2. Set up Supabase

Run each migration file in order in the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql):

```
migrations/001_create_items_table.sql
migrations/002_add_valuation_columns.sql
migrations/003_add_previous_value.sql
migrations/004_create_valuation_history.sql
```

Create a **private storage bucket** named `item-images`.

### 3. Run

```bash
docker compose up --build
```

- Backend API: `http://localhost:8000`
- Frontend (Expo): `http://localhost:8081`
- API docs: `http://localhost:8000/docs`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/upload` | Get signed upload URL for Supabase Storage |
| `POST` | `/items/detect` | AI item detection from image URL |
| `POST` | `/items` | Create item |
| `GET` | `/items` | List user's items |
| `GET` | `/items/{id}` | Get single item |
| `PATCH` | `/items/{id}` | Update purchase info |
| `DELETE` | `/items/{id}` | Delete item |
| `GET` | `/items/{id}/valuation?force=false` | Get valuation (cached or fresh) |
| `GET` | `/items/{id}/valuation/history` | Valuation history |
| `POST` | `/items/{id}/metadata` | Add metadata key-value pair |
| `GET` | `/items/{id}/metadata` | List metadata |
| `DELETE` | `/items/{id}/metadata/{meta_id}` | Delete metadata entry |
| `GET` | `/assets/summary` | Portfolio summary |

All endpoints except `/health` require a `Bearer` token from Supabase Auth.

## Key Design Decisions

- **AI output is untrusted** — Detection and valuation results are suggestions. Users confirm before data is saved.
- **JSONB metadata** — Flexible key-value storage instead of rigid columns for item attributes.
- **RLS enforcement** — Supabase Row-Level Security policies ensure per-user data isolation at the database level.
- **Valuation stability** — Values are smoothed, clamped, and anchored to prevent confusing jumps between updates.
- **Categories are free-text** — No enforced enum; users and AI can use any category string.
