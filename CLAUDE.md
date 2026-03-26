# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LocalScribe is a local writing assistant application with a React/Vite frontend and Python/FastAPI backend. It provides features for note-taking, world-building, character management, and text analysis.

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
# Run server with auto‑reload
./venv/bin/uvicorn app.main:app --reload
# Run tests
./venv/bin/pytest
# Run tests with coverage
./venv/bin/pytest --cov=app
# Format code (black)
./venv/bin/black app tests
# Sort imports (isort)
./venv/bin/isort app tests
# Lint (flake8)
./venv/bin/flake8 app tests
# Type check (mypy)
./venv/bin/mypy app
# Create a new database migration (after model changes)
./venv/bin/alembic revision --autogenerate -m "description"
# Apply migrations
./venv/bin/alembic upgrade head
```

### Frontend
```bash
cd frontend
# Dev server
npm run dev
# Build for production
npm run build
# Preview production build
npm run preview
# Generate TypeScript types from OpenAPI spec (requires backend running)
npm run gen:types
# Lint (ESLint)
npx eslint src --ext ts,tsx
```

## Architecture

### Backend Structure (`backend/app/`)
- `core/` – configuration, database setup, logging, dependencies, exceptions
- `models/` – SQLAlchemy ORM models (Note, Project, Character, Outline, WorldBuilding, Folder)
- `services/` – business logic (ai_service, directory_service, analysis_service)
- `api/` – FastAPI route handlers (organized by feature)
- `utils/` – helper functions (Chinese text processing, file utilities)

API routes are versioned under `/api/v1/` (see `app/api/v1/`). The main router mounts them under `/api` (see `app/main.py`). CORS is configured for the frontend dev server.

Database migrations are managed by Alembic (`migrations/`). The SQLite file is stored in `backend/data/`.

### Frontend Structure (`frontend/src/`)
- `components/` – reusable UI components (editor, sidebar, modals, etc.)
- `pages/` – route‑level components (EditorPage, TrashPage)
- `stores/` – Zustand state stores
- `services/` – API clients (worldbuildingApi.ts, analysisApi.ts)
- `hooks/` – custom React hooks
- `utils/` – helper functions
- `types/` – TypeScript definitions (including auto‑generated API types)
- Uses path alias `@` for `src` (configured in `tsconfig.json` and `vite.config.ts`)

### State & API Communication
- **State management**: Zustand stores in `src/stores/`
- **API calls**: Axios‑based services in `src/services/`, wrapped with React Query (`@tanstack/react-query`)
- **Routing**: React Router v6 with lazy‑loaded pages

### Styling
- Tailwind CSS with a custom color system using CSS variables (see `tailwind.config.js`)
- Radix UI components for accessible primitives
- CSS‑in‑JS via `clsx` and `tailwind-merge`

## Database

- SQLite database file: `backend/data/local_scribe.db`
- Migrations: `alembic upgrade head` applies pending migrations.
- New migrations are created with `alembic revision --autogenerate` after model changes.
- The database URL is configured in `backend/.env` (`DATABASE_URL`).

### Database Migration Guidelines

When creating new Alembic migrations, follow these best practices to ensure SQLite compatibility and avoid conflicts:

#### 1. Always Use Batch Mode for SQLite
SQLite has limited ALTER TABLE support. Always use `batch_alter_table` for schema changes:

**Important SQLite Limitations:**
- SQLite does **NOT** support direct `ALTER TABLE` for constraints (ADD/DROP CONSTRAINT)
- SQLite does **NOT** support `ALTER TABLE` for dropping columns in most cases
- SQLite does **NOT** support changing column types or nullability directly
- All schema changes must use `batch_alter_table` which recreates the table behind the scenes

**Common Errors to Avoid:**
```python
# ❌ WRONG - Will fail with "No support for ALTER of constraints in SQLite dialect"
op.drop_constraint('fk_name', 'table_name', type_='foreignkey')
op.create_foreign_key('fk_name', 'table_name', ['col'], ['ref_col'])

# ✅ CORRECT - Use batch_alter_table
with op.batch_alter_table('table_name', schema=None) as batch_op:
    batch_op.drop_constraint('fk_name', type_='foreignkey')
    batch_op.create_foreign_key('fk_name', 'ref_table', ['col'], ['ref_col'])
```

```python
def upgrade() -> None:
    with op.batch_alter_table('table_name', schema=None) as batch_op:
        batch_op.add_column(sa.Column('new_column', sa.String(36), nullable=True))
        batch_op.create_foreign_key(
            'fk_name', 'ref_table',
            ['column'], ['ref_column'],
            ondelete='SET NULL'
        )
        batch_op.create_index('ix_name', ['column'], unique=False)

def downgrade() -> None:
    with op.batch_alter_table('table_name', schema=None) as batch_op:
        batch_op.drop_index('ix_name')
        batch_op.drop_constraint('fk_name', type_='foreignkey')
        batch_op.drop_column('new_column')
```

#### 2. Add Existence Checks for Idempotency
Make migrations safe to run multiple times by checking if objects already exist:

```python
def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Check if column already exists
    columns = [col['name'] for col in inspector.get_columns('table_name')]
    if 'new_column' in columns:
        return  # Skip if already exists
    
    with op.batch_alter_table('table_name', schema=None) as batch_op:
        batch_op.add_column(sa.Column('new_column', sa.String(36), nullable=True))
```

#### 3. Never Modify Published Migrations
Once a migration is pushed to the repository, never modify it. If you need to fix something:
- Create a new migration to correct the issue
- Or use `fix_migrations.py` to check and repair

#### 4. Maintain Linear Migration History
Avoid creating migration branches. Always base new migrations on the current head:
```bash
# Check current migration status
./venv/bin/alembic current
./venv/bin/alembic history

# Create new migration from current head
./venv/bin/alembic revision --autogenerate -m "description"
```

#### 5. Team Development Rules
- **Never commit database files** (`*.db`, `*.sqlite3`) - already in `.gitignore`
- Run migrations before committing model changes
- If migration conflicts occur, use `fix_migrations.py` to diagnose

## Testing & Quality

### Backend
- Tests are in `backend/tests/` using pytest.
- Use `pytest -v` for verbose output, `pytest --cov=app` for coverage.
- Code formatting: black, isort
- Linting: flake8
- Type checking: mypy

### Frontend
- ESLint is configured for TypeScript/React (see `frontend/.eslintrc.cjs`). It uses `eslint:recommended`, `@typescript-eslint/recommended`, and `react-hooks/recommended` with custom rules for unused variables and `any` types.
- No unit‑test framework is currently set up.

## Useful Scripts

- `setup.sh` – full installation script (installs system dependencies, Node.js 22.x, Python virtual environment, runs migrations)
- `scripts/backup_db.sh` – placeholder for database backup (empty)
- `scripts/generate_types.sh` – placeholder for generating TypeScript types (empty)

## Notes

- The frontend dev server proxies `/api` to `http://localhost:8000` (see `frontend/vite.config.ts`).
- Backend environment variables are in `backend/.env` (currently only `DATABASE_URL`).
- The project uses Chinese‑language comments and logs throughout.