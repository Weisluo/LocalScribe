# AGENTS.md

## Project Overview

LocalScribe is a local writing assistant application with a React/Vite frontend and Python/FastAPI backend. It provides features for note-taking, world-building, character management, and outline management.

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, Zustand (state), React Query (API), TipTap (editor), DND Kit (drag-and-drop)
- **Backend**: FastAPI, SQLAlchemy (SQLite), Alembic (migrations), Pydantic v2
- **Database**: SQLite (file at `backend/data/local_scribe.db`)

## Development Setup

1. Run the setup script to install dependencies (requires Node.js 22.x, Python 3, pip):
   ```bash
   ./setup.sh
   ```
   This installs system dependencies, creates a Python virtual environment in `backend/venv`, installs backend and frontend packages, and runs database migrations.

2. Start the backend server:
   ```bash
   cd backend && ./venv/bin/uvicorn app.main:app --reload
   ```
   API runs on http://localhost:8000 with auto‑reload.

3. Start the frontend dev server (in another terminal):
   ```bash
   cd frontend && npm run dev
   ```
   Frontend runs on http://localhost:5173 and proxies `/api` requests to the backend.

## Common Commands

### Backend
```bash
cd backend
./venv/bin/uvicorn app.main:app --reload          # Run server
./venv/bin/pytest                                 # Run tests
./venv/bin/pytest --cov=app                       # Test with coverage
./venv/bin/black app tests && ./venv/bin/isort app tests  # Format
./venv/bin/flake8 app tests                       # Lint
./venv/bin/mypy app                               # Type check
./venv/bin/alembic revision --autogenerate -m "desc"  # New migration
./venv/bin/alembic upgrade head                   # Apply migrations
```

### Frontend
```bash
cd frontend
npm run dev          # Dev server
npm run build        # Production build
npm run preview      # Preview build
npm run gen:types    # Generate TS types from OpenAPI (backend must be running)
npx eslint src --ext ts,tsx  # Lint
```

## Architecture

### Backend (`backend/app/`)
- `core/` – config, database, logging, dependencies, exceptions
- `models/` – SQLAlchemy ORM (Note, Project, Character, Outline, WorldBuilding, Folder, Relation)
- `services/` – business logic (ai_service, directory_service, analysis_service, relation_service)
- `api/v1/` – FastAPI routes (notes, folders, projects, characters, outlines, worldbuilding, relations, ai, analysis, upload)
- `utils/` – helpers (Chinese text processing, file utilities)

Migrations: Alembic. SQLite: `backend/data/local_scribe.db`.

### Frontend (`frontend/src/`)
- `components/` – UI components (Editor, DirectoryTree, CharacterDesign, Worldbuilding, Outline, AIChat, Trash)
- `stores/` – Zustand stores (note, project, character, editor settings, toast, UI)
- `services/` – API clients (axios + React Query)
- `hooks/` – custom hooks | `utils/` – helpers | `types/` – TS definitions
- State: Zustand | API: React Query | Routing: React Router v6
- Styling: Tailwind CSS + Radix UI
- Dev server proxies `/api` to `http://localhost:8000`

## Database Migration Guidelines

SQLite has limited ALTER TABLE support. Follow these rules:

1. **Always use `batch_alter_table`**
   ```python
   with op.batch_alter_table('table_name', schema=None) as batch_op:
       batch_op.add_column(sa.Column('new_column', sa.String(36), nullable=True))
   ```

2. **Add existence checks for idempotency**
   ```python
   def upgrade() -> None:
       conn = op.get_bind()
       if 'new_column' in [c['name'] for c in sa.inspect(conn).get_columns('table')]:
           return
       # ... migration code
   ```

3. **Never modify published migrations** – create new ones to fix issues
4. **Maintain linear history** – base new migrations on current head
5. **Never commit database files** – already in `.gitignore`

## Notes

- Project uses Chinese-language comments and logs throughout.

## Frontend Development Guidelines

- **Use toast instead of alert** - Use Sonner's `toast.success()` / `toast.error()` instead of native `alert()`

## Coding Principles

### 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
