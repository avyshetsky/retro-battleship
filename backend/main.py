"""Root entrypoint shim.

Re-exports the FastAPI application defined in :mod:`app.main` so tooling that
looks for a top-level ``main:app`` (some managed deploy targets) resolves it.
"""

from app.main import app

__all__ = ["app"]
