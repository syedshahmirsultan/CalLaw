# CalLaw - Backend Service

High-reliability, anti-hallucination California legal information API built with FastAPI, SQLAlchemy (asyncio), and PostgreSQL.

---

## 🏛️ Architecture Overview

The CalLaw backend orchestrates a multi-step, zero-hallucination legal agent that strictly adheres to verified California primary law sources:

- **FastAPI**: High-performance asynchronous REST API.
- **SQLAlchemy 2.0 (AsyncIO)**: Fully asynchronous ORM supporting PostgreSQL (`asyncpg`) and SQLite (`aiosqlite`).
- **Clerk Authentication**: Hardware/cloud identity verification using JWT signature and JWKS decoding.
- **Agent Coordinator State Machine**:
  `UNDERSTANDING` ➔ `CLARIFYING` ➔ `READY_FOR_RESEARCH` ➔ `RESEARCHING` ➔ `ANALYZING` ➔ `ANSWERING` (or `INSUFFICIENT_EVIDENCE`).
- **Propose → Verify → Ground**: the LLM proposes candidate sections from any of the 29 California codes or the Constitution; every candidate is fetched live from `leginfo.legislature.ca.gov` (nonexistent citations are rejected); the answer is written only from the verified text; quotes are checked in code to be verbatim and unverified section numbers are repaired or removed.
- **Streaming**: `POST /api/v1/conversations/{id}/messages/stream` emits Server-Sent Events for each research stage, then the final result.
- Official text is cached in `app/data/leginfo_cache/` for 7 days (safe to delete).

---

## 🚀 Quickstart & Setup

### 1. Prerequisites
- Python 3.11+
- Virtual environment (`venv`)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Installation
```bash
# Create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Configure the AI model
Set `LLM_PROVIDER` and a valid `LLM_API_KEY` in `.env` (see `.env.example`). Without a working key the
assistant replies that its AI engine is unavailable instead of guessing.

### 5. Running the Development Server
```bash
python -m uvicorn app.main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Healthcheck: `http://localhost:8000/api/v1/health`

### 6. Running the Automated Test Suite
```bash
pytest -v
```
Tests use a scripted LLM and a fake leginfo, so they run offline in about a second.

---

## 🔒 Security & Anti-Hallucination Guardrails

1. **Strict Cross-Tenant Isolation**: Every database query verifies `conversation.user_id == current_user.id`. Any attempt by another user to view or modify an inquiry results in a `404 Not Found`.
2. **Authoritative Primary Sources Only**: Statutes, section numbers, titles, and URLs are drawn exclusively from official California sources (`leginfo.legislature.ca.gov`). The agent never guesses or invents section numbers or external links.
3. **Evidence-Deficient Shielding**: If no verified California authority matches a scenario, the agent returns `INSUFFICIENT_EVIDENCE` rather than fabricating an answer.
