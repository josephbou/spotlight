# Spotlight Custom Build Guide

This guide covers how to set up, develop, build, and use your customized version of Renumics Spotlight.

## Prerequisites

- **Python 3.9-3.13** (Python 3.12.10 recommended)
- **UV** - Modern Python package manager ([Installation](https://docs.astral.sh/uv/getting-started/installation/))
- **Node.js 20.14.0** - For frontend development
- **pnpm 9.4.0** - JavaScript package manager

## Initial Setup

### 1. Install Dependencies

```bash
# Install Python dependencies (including dev tools)
uv sync --all-extras --group dev

# Install JavaScript dependencies
pnpm install
```

This will:
- Create a `.venv` virtual environment in the project root
- Install all Python runtime and development dependencies
- Install frontend Node.js dependencies

### 2. Optional: Install Pre-commit Hooks

```bash
# If using direnv, hooks are installed automatically
# Otherwise, manually install:
pre-commit install --hook-type pre-commit
pre-commit install --hook-type pre-push
```

## Development Workflow

### Running the Development Server

```bash
# Start Spotlight with a sample dataset
make dev

# Or with a specific dataset
TABLE_FILE="path/to/your/data.h5" make dev

# Or run directly with UV
uv run spotlight --analyze-all
```

### Code Quality Checks

```bash
# Type checking (mypy)
make typecheck

# Linting (ruff for Python, eslint for TypeScript)
make lint

# Format code (black for Python, prettier for TypeScript)
make format

# Check formatting without modifying files
make check-format
```

### Running Tests

```bash
# Run all tests (may take a while)
make test

# Run specific test suites
make unit-test        # Python + TypeScript unit tests
make doc-test         # Python docstring tests
make integration-test # API integration tests

# Run a specific test file
uv run pytest tests/unit/path/to/test_file.py

# Run a specific test function
uv run pytest tests/unit/path/to/test_file.py::test_function_name
```

## Building the Package

### Build Process Overview

Spotlight is a dual-stack project:
1. **Frontend** (React/TypeScript) - Built with Vite
2. **Backend** (Python) - Packaged as a wheel with frontend assets included

### Step-by-Step Build

#### 1. Build the Frontend

```bash
make build-frontend
```

This creates the compiled frontend in `build/frontend/` directory.

**What happens:**
- Vite compiles TypeScript/React code
- Bundles are minified and optimized
- Output goes to `build/frontend/`

#### 2. Build the Python Wheel

```bash
make build-wheel
```

This creates the Python wheel with frontend assets included.

**What happens:**
- Removes the development symlink at `renumics/spotlight/backend/statics`
- Copies `build/frontend/` into `renumics/spotlight/backend/statics/`
- Builds the wheel using UV's build backend
- Wheel is placed in `build/dist/`
- Restores the development symlink

**Output:** `build/dist/renumics_spotlight-1.7.1.custom-py3-none-any.whl`

#### 3. Build Both (Recommended)

```bash
make build
```

This runs both `build-frontend` and `build-wheel` in sequence.

### Quick Build Commands

```bash
# Full build (frontend + wheel)
make build

# Just frontend
pnpm run build

# Just wheel (requires frontend to exist)
uv build --wheel
```

## Using Your Custom Wheel

### Install in Another Project

Once you've built the wheel, you can use it in any Python project:

```bash
# Using UV (recommended)
uv pip install /path/to/spotlight-custom/build/dist/renumics_spotlight-1.7.1.custom-py3-none-any.whl

# Using standard pip
pip install /path/to/spotlight-custom/build/dist/renumics_spotlight-1.7.1.custom-py3-none-any.whl

# Or with a relative path
uv pip install ../spotlight-custom/build/dist/renumics_spotlight-1.7.1.custom-py3-none-any.whl
```

### Use in Your Python Code

```python
from renumics import spotlight
import pandas as pd

# Load your dataset
df = pd.read_csv("your_data.csv")

# Launch Spotlight with your custom modifications
spotlight.show(df, dtype={"image_column": spotlight.Image})
```

### Verify Installation

```bash
# Check installed version
python -c "from renumics.spotlight import __version__; print(__version__)"
# Output: 1.7.1-custom

# Verify CLI works
spotlight --help
```

## Making Modifications

### 1. Modify Python Backend Code

Edit files in `renumics/spotlight/`:

```bash
# Your modifications
vim renumics/spotlight/viewer.py

# Test your changes
uv run pytest tests/unit/

# Rebuild
make build
```

### 2. Modify TypeScript Frontend Code

Edit files in `src/`:

```bash
# Your modifications
vim src/components/YourComponent.tsx

# Test with hot reload
pnpm run dev

# Or rebuild
make build-frontend
```

### 3. Add New Dependencies

**Python dependencies:**
```bash
# Add runtime dependency
uv add package-name

# Add dev dependency
uv add --dev package-name

# Add to specific group
uv add --group dev package-name
```

**JavaScript dependencies:**
```bash
# Add runtime dependency
pnpm add package-name

# Add dev dependency
pnpm add -D package-name
```

### 4. Update Version

Edit `pyproject.toml` and `renumics/spotlight/__version__.py`:

```toml
# pyproject.toml
version = "1.7.2-custom"
```

```python
# renumics/spotlight/__version__.py
__version__ = "1.7.2-custom"
```

Also update `Makefile`:
```makefile
export VERSION := 1.7.2-custom
```

## Troubleshooting

### Frontend Build Issues

**Problem:** "Frontend directory missing!"

**Solution:**
```bash
# Build frontend first
make build-frontend

# Then build wheel
make build-wheel
```

### Dependency Conflicts

**Problem:** Package version conflicts

**Solution:**
```bash
# Clear cache and reinstall
rm -rf .venv uv.lock
uv sync --all-extras --group dev
```

### Import Errors

**Problem:** "Module not found" when importing

**Solution:**
```bash
# Ensure you're in the virtual environment
source .venv/bin/activate

# Or use uv run
uv run python your_script.py
```

### Stale Frontend in Wheel

**Problem:** Wheel contains old frontend code

**Solution:**
```bash
# Clean build artifacts
rm -rf build/ dist/

# Rebuild everything
make clean
make build
```

## Project Structure

```
spotlight-custom/
├── renumics/spotlight/        # Python backend
│   ├── backend/              # FastAPI app
│   ├── dataset/              # Data handling
│   ├── dtypes/               # Data type definitions
│   └── ...
├── src/                      # TypeScript frontend
│   ├── components/           # React components
│   ├── lenses/              # Data type viewers
│   ├── stores/              # Zustand state
│   └── ...
├── tests/                   # Test suites
├── build/
│   ├── frontend/           # Compiled frontend (gitignored)
│   └── dist/               # Built wheels (gitignored)
├── pyproject.toml          # Python project config
├── package.json            # JavaScript project config
├── Makefile               # Build automation
└── BUILD_GUIDE.md         # This file
```

## Additional Resources

- **Original Spotlight Docs:** https://spotlight.renumics.com
- **UV Documentation:** https://docs.astral.sh/uv/
- **Python Package:** https://pypi.org/project/renumics-spotlight/

## Common Make Targets

```bash
make help              # Show all available targets
make init              # Initial setup (dependencies)
make dev               # Run development server
make build             # Build frontend + wheel
make test              # Run all tests
make lint              # Lint all code
make format            # Format all code
make typecheck         # Type check Python + TypeScript
make clean             # Clean build artifacts
```

## Quick Reference

| Task | Command |
|------|---------|
| Install deps | `uv sync --all-extras --group dev && pnpm install` |
| Run dev server | `make dev` |
| Build wheel | `make build` |
| Run tests | `make test` |
| Format code | `make format` |
| Type check | `make typecheck` |
| Install wheel | `uv pip install build/dist/*.whl` |
| Add Python dep | `uv add package-name` |
| Add JS dep | `pnpm add package-name` |
