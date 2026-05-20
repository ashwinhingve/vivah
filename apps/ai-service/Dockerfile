# Smart Shaadi AI Service — production Dockerfile
#
# Targets: Railway / any container platform. Region: ap-south-1.
# Healthcheck: /health · Readiness: /ready (validates Guna Milan loadable).

FROM python:3.11-slim AS base

# Install system deps for scikit-learn / numpy
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pin pip + setuptools for reproducible builds
RUN pip install --no-cache-dir --upgrade pip==24.3.1 setuptools==75.3.0

# Copy project metadata first for layer cache
COPY pyproject.toml ./

# Install runtime deps (sentry-sdk + structlog + everything in pyproject)
# torch is large (~2GB); pin to CPU-only wheels for production
RUN pip install --no-cache-dir \
        --extra-index-url https://download.pytorch.org/whl/cpu \
        '.'

# Pre-warm the HuggingFace XLM-RoBERTa sentiment model into the image
# (P1-10, docs/PHASE-1-4-AUDIT.md). Without this, the first request that
# touches the Emotional Score endpoint triggers a ~1 GB download from
# huggingface.co — Railway's request timeout (typically 30 s) fires
# before the model can finish loading, and the user sees a 504.
#
# By baking the model into a build layer we get:
#   - Cold-start latency drops from ~60 s to ~3 s on Railway
#   - Network outages at HuggingFace do not block production startup
#   - The image is ~1 GB larger; acceptable for an AI service container
ENV HF_HOME=/app/.cache/huggingface
RUN python -c "from transformers import pipeline; \
    pipeline('sentiment-analysis', \
             model='cardiffnlp/twitter-xlm-roberta-base-sentiment')"

# Copy source
COPY src ./src

# Non-root user
RUN useradd --create-home --uid 1001 vivah && chown -R vivah:vivah /app
USER vivah

EXPOSE 8000

# Healthcheck — Railway uses /health; we add /ready as the readiness gate
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1

# uvicorn in single-worker mode; scale via Railway replicas, not workers
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000} --log-config /dev/null"]
