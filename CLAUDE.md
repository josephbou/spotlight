# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Renumics Spotlight is a data visualization tool for exploring unstructured datasets (images, audio, text, video, time-series, geometric data) from pandas DataFrames. It consists of:
- **Python backend**: FastAPI server with data processing, plugin system, and WebSocket communication
- **TypeScript/React frontend**: Vite-based SPA with flexlayout for workspace management, zustand for state, and specialized "lenses" for different data types

## Development Setup

### Prerequisites
- Python 3.9-3.13
- Node.js (managed via pnpm)
- UV for Python dependency management
- pnpm for JavaScript dependency management

### Installation
```bash
# Full development setup (Python + JavaScript)
make init

# With playbook dependencies (includes torch, cleanlab)
make init-playbook

# Or directly with UV
uv sync --all-extras --group dev
pnpm install
```

### Running Development Server
```bash
# Start dev server with hot reload
make dev

# Customize with different dataset
TABLE_FILE="path/to/data.h5" make dev
```

## Common Commands

### Build & Packaging
```bash
# Build complete package (frontend + Python wheel)
make build

# Build only frontend (outputs to build/frontend/)
make build-frontend

# Build only Python wheel (requires frontend to exist)
make build-wheel

# Validate wheel contents
make check-wheel
```

### Code Quality
```bash
# Type checking (Python + TypeScript)
make typecheck

# Linting (uses ruff for Python, eslint for TypeScript)
make lint

# Format code (ruff for Python, prettier for TypeScript)
make format

# Check formatting without modifying
make check-format

# Security audit
make audit
```

### Testing
```bash
# Run all tests (unit + doc + integration + ui)
make test

# Run specific test suites
make unit-test        # Python pytest + Jest for TypeScript
make doc-test         # Python docstring tests
make integration-test # API integration tests
make ui-test          # Selenium-based UI tests (Chrome + Firefox)

# Run specific UI browser tests
make ui-test-chrome
make ui-test-firefox
```

### Python-Specific Commands
```bash
# Run single Python test file
uv run pytest tests/unit/path/to/test_file.py

# Run single test function
uv run pytest tests/unit/path/to/test_file.py::test_function_name

# Type check specific module
uv run mypy -p renumics.spotlight

# Add a dependency
uv add package-name

# Add a dev dependency
uv add --dev package-name
```

### TypeScript-Specific Commands
```bash
# Frontend dev server only
pnpm run dev

# Frontend build
pnpm run build

# TypeScript type checking (watch mode)
pnpm run typecheck:watch

# Run frontend tests only
pnpm run test

# Run API integration tests
pnpm run api-test
```

### Documentation
```bash
# Generate API documentation
make docs

# Copy docs to docs repository
DOCS_REPOSITORY=../spotlight-docs make dist-docs
```

### API Client Generation
```bash
# Regenerate OpenAPI client from spec
make api-client
```

## Architecture

### Python Backend (`renumics/spotlight/`)

**Core Components:**
- `app.py`: Main FastAPI application
- `server.py`: Server process management, multiprocessing coordination
- `cli.py`: Command-line interface entry point
- `viewer.py`: High-level API for launching Spotlight viewer
- `dataset/`: Dataset handling, column types, data conversion
- `data_source/`: Data source abstractions (pandas, HDF5, Hugging Face datasets)
- `backend/`: FastAPI backend implementation
  - `apis/`: REST API endpoints
  - `websockets.py`: WebSocket handlers for real-time communication
  - `tasks/`: Background task processing
  - `statics/` → symlink to `build/frontend/`
- `dtypes/`: Data type definitions and conversion logic
- `media/`: Media file handling (images, audio, video, meshes)
- `plugin_loader.py`: Plugin system for extending functionality
- `spotlight_plugins/`: Built-in plugins (e.g., core plugin)

**Key Patterns:**
- FastAPI for REST + WebSocket endpoints
- Multiprocessing for server isolation
- Pydantic v2 for data validation
- H5py for efficient data storage
- Plugin architecture for extensibility

### TypeScript Frontend (`src/`)

**Directory Structure:**
- `components/`: React components (AppBar, StatusBar, ToolBar, Workspace)
- `lenses/`: Data type viewers (ImageLens, AudioLens, VideoLens, MeshLens, etc.)
- `stores/`: Zustand state management
  - `dataset/`: Dataset state, columns, statistics, color transfer functions
  - `layout.ts`: Workspace layout persistence
  - `components.ts`: UI component registry
  - `pluginStore.ts`: Plugin state
- `api/`: API client wrappers
- `client/`: Auto-generated OpenAPI TypeScript client
- `hooks/`: Custom React hooks
- `systems/`: Core systems (drag-and-drop, etc.)
- `widgets/`: Reusable UI widgets
- `types/`: TypeScript type definitions
- `dataformat/`: Data format handling
- `styles/`: Global styles and theme

**Key Patterns:**
- Zustand for state management (not Redux or Context API)
- Flexlayout-react for workspace layout system
- Twin.macro for Tailwind + styled-components
- React Three Fiber for 3D rendering (meshes, point clouds)
- D3 for visualizations
- Web Workers for heavy computations (e.g., `relevanceWorker.ts`)

### Data Flow
1. Python backend serves data via FastAPI endpoints
2. Frontend fetches dataset metadata and columns
3. Zustand stores manage dataset, layout, and component state
4. Lenses render data based on column dtypes
5. WebSocket connection for real-time updates
6. Workspace layout managed by flexlayout-react, persisted to local storage

### Plugin System
- Plugins can add custom data types, lenses, and analysis
- Backend plugins in `renumics/spotlight_plugins/`
- Plugin loader in `plugin_loader.py`
- Frontend plugin store in `stores/pluginStore.ts`

## Important Constraints

### Python
- Use `uv` for dependency management and running commands
- All commands should use `uv run` prefix (e.g., `uv run pytest`, `uv run mypy`)
- Type hints required (`disallow_untyped_defs = true` in mypy config)
- Ruff linting with `extend-select = ["I"]` for import sorting
- Ruff for code formatting
- Pre-commit hooks enforce quality checks
- Static versioning in pyproject.toml (version = "1.7.1-custom")

### TypeScript
- Use twin.macro for styling (Tailwind + styled-components)
- ESLint with React, TypeScript, import, and a11y plugins
- Prettier for code formatting
- Jest for testing
- Do not modify files in `src/client/` (auto-generated from OpenAPI spec)

### Build Process
- Frontend must be built before Python wheel
- Frontend build output goes to `build/frontend/`
- Python package includes frontend via symlink during development
- Production wheel copies frontend into package

### Testing
- Python tests in `tests/` (unit, integration, ui)
- TypeScript tests colocated with source files (Jest)
- UI tests use Selenium with Chrome and Firefox
- Test datasets generated via `scripts/generate_*_test_data.py`

### Pre-commit Hooks
- Ruff linting and fixing
- Mypy type checking (for renumics/ and scripts/)
- Black formatting
- Prettier formatting
- ESLint
- Various file checks (trailing whitespace, JSON/YAML/TOML validation, etc.)

## Key Files

- `pyproject.toml`: Python project metadata, dependencies, tool configs (uses UV build backend)
- `package.json`: JavaScript dependencies and scripts
- `Makefile`: Primary task runner for development (all UV commands)
- `vite.config.ts`: Frontend build configuration
- `.pre-commit-config.yaml`: Pre-commit hook configuration
- `renumics/spotlight/__version__.py`: Static version number
- `BUILD_GUIDE.md`: Comprehensive build and usage guide

## Common Gotchas

1. **Frontend statics symlink**: In development, `renumics/spotlight/backend/statics` is a symlink to `build/frontend/`. Don't commit the symlink target.
2. **Auto-generated code**: Never edit `src/client/` directly - regenerate via `make api-client`
3. **Static versioning**: Version is now static and must be manually updated in `pyproject.toml`, `renumics/spotlight/__version__.py`, and `Makefile`
4. **Environment variables**: `SPOTLIGHT_DEV` controls dev mode, `SPOTLIGHT_TABLE_FILE` sets default dataset
5. **Twin.macro**: Uses babel macros, requires specific babel plugin configuration
6. **React props**: Some Three.js components use non-standard props (tw, css, transparent, etc.) - these are allowed in ESLint config
7. **UV lockfile**: `uv.lock` is gitignored; each developer generates their own based on `pyproject.toml`
