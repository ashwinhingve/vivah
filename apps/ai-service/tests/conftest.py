"""
Test environment setup.
Sets AI_SERVICE_API_KEY before any src module imports, so both the
middleware (reads once at import) and the per-route dependency
(reads at call time) see the same key the TestClient sends.
"""
import os

os.environ["AI_SERVICE_API_KEY"] = "dev-internal-key-change-in-prod"
