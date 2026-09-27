# CalLaw

**Describe your situation in plain words. CalLaw asks what it needs to know, then shows you the California laws that apply to you, quoted from the official text.**

CalLaw is a legal information assistant for California residents. It is a hackathon prototype: it explains state law, it does not give legal advice.

---

## What it does

1. **You describe what happened**, for example: *"I rented this apartment 8 months ago. Now my landlord is increasing the rent without any notice."*
2. **It asks clarifying questions** only when a missing fact changes which law applies (lease type, amounts, dates). Up to 3 questions, with tap-to-answer options, at most 2 rounds.
3. **It answers with the law that applies to you**: a one-sentence bottom line, a plain-English explanation using your facts, each law with a verbatim quote and a link to the official text, practical next steps, what could change the answer, and suggested follow-up questions.
4. **It refuses to guess.** If no California statute covers the situation, it says so. If the matter is federal (visas, immigration, federal tax), it says that federal law governs and points to the right help.

## How answers stay accurate

CalLaw uses a **propose, verify, ground** pipeline. The AI never answers from memory.

| Step | What happens |
|---|---|
| 1. Understand | The LLM reads the conversation, decides whether to ask questions, and proposes candidate code sections. |
| 2. Verify | Every candidate is fetched live from [leginfo.legislature.ca.gov](https://leginfo.legislature.ca.gov). Sections that do not exist are rejected. |
| 3. Explain | The LLM writes the answer using **only** the verified official text, matching the user's facts to the specific subdivision that applies. |
| 4. Check | Code (not the LLM) verifies that every quote appears word-for-word in the official text, and removes any section number that was not verified. |

Coverage: all 29 California codes and the California Constitution. Not covered: state regulations (CCR), court decisions, city or county ordinances, and federal law. When these may matter, the answer lists them under "What could change this answer".

## Features

- Live research progress streamed to the UI (each law appears as it is verified)
- Guest mode: **one free question** without an account; sign up to continue. The guest conversation moves into the new account.
- Accounts via Clerk; history saved per user
- Light, dark, and system themes
- Print or save any answer as PDF
- Animated, responsive interface (respects "reduce motion")

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Auth | Clerk |
| Backend | FastAPI, SQLAlchemy 2 (async), SQLite (PostgreSQL supported) |
| AI | Any of: Groq, Anthropic, OpenAI, Gemini, OpenRouter (configured via env) |
| Legal source | leginfo.legislature.ca.gov, fetched live and cached for 7 days |

---

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+
- An LLM API key (Groq, Anthropic, OpenAI, or Gemini)
- A Clerk application (optional; without it everyone is a guest)

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
cp .env.example .env           # then fill in the values below
python -m uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local     # then fill in the values below
npm run dev
```

Open http://localhost:3000

---

## Configuration

### `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `LLM_PROVIDER` | Yes | `groq`, `anthropic`, `openai`, `gemini`, or `openrouter` |
| `LLM_API_KEY` | Yes | API key for that provider |
| `LLM_MODEL` | No | Model name. Empty uses the provider default (Groq: `openai/gpt-oss-120b`) |
| `LLM_BASE_URL` | No | Custom endpoint for OpenAI-compatible providers |
| `DATABASE_URL` | No | Default `sqlite+aiosqlite:///./callaw.db` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | For accounts | Used to derive the Clerk issuer for token verification |
| `CLERK_SECRET_KEY` | For accounts | Clerk secret key |
| `GUEST_MESSAGE_LIMIT` | No | Messages a guest may send before signing up. Default `1` |
| `ENVIRONMENT` | No | `development` enables `dev_*` test tokens. Use `production` when deployed |

### `frontend/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_BACKEND_API_URL` | Default `http://localhost:8000/api/v1` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (same as backend) |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` | `/sign-in` and `/sign-up` |

---

## API

All routes are under `/api/v1`. Send `Authorization: Bearer <token>`, where the token is a Clerk session token or a guest id (`guest_<uuid4>`).

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service and database status |
| GET | `/auth/me` | Current user, including `is_guest` |
| POST | `/auth/claim` | Move guest conversations into the signed-in account |
| GET | `/conversations` | List the user's conversations |
| POST | `/conversations` | Create a conversation |
| GET | `/conversations/{id}` | Conversation with messages and sources |
| PATCH | `/conversations/{id}` | Rename |
| DELETE | `/conversations/{id}` | Delete |
| GET | `/conversations/{id}/messages` | Messages |
| POST | `/conversations/{id}/messages` | Send a message and get the full answer |
| POST | `/conversations/{id}/messages/stream` | Same, streamed as Server-Sent Events (progress, then the final answer) |

A guest who has used their free message receives `403` with `{"code": "signup_required"}`.

---

## Project structure

```
backend/
  app/
    agent/          coordinator.py (pipeline), prompts.py, grounding.py (quote and citation checks)
    api/            routes (v1/), guards.py (guest limit)
    services/       leginfo_client.py (official statute fetcher), llm_service.py, conversation/user services
    db/             SQLAlchemy models and auto-migration
    data/           curated index of common statutes (hints only) and the leginfo cache
  tests/            pytest suite
frontend/
  app/              landing page, /chat, /chat/[id], /sign-in, /sign-up
  components/       chat/, legal/, landing/, auth/, sidebar/, motion/, theme/, ui/
  lib/              api client, auth and guest session, theming, utilities
```

## Tests

```bash
cd backend
pytest -q
```

42 tests cover the grounding checks (fake citations rejected, paraphrased quotes replaced, unverified section numbers removed), clarification limits, federal-law handling, streaming, the guest limit, and moving guest conversations into an account. The LLM and leginfo are replaced with fakes, so the suite runs offline in about 2 seconds.

## Known limitations

- Free-tier LLM rate limits (for example Groq's 8,000 tokens per minute) can make answers take 30 to 60 seconds.
- leginfo.legislature.ca.gov is occasionally slow; the agent continues with the laws verified within about 15 seconds.
- A law is only found if the model proposes it; keyword search of leginfo is not yet implemented.
- Guest ids live in the browser, so clearing storage grants another free question. Add per-IP limits before a public launch.
