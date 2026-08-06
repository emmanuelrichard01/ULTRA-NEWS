FROM python:3.11-slim

WORKDIR /app

# Python optimization
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --default-timeout=100 --no-cache-dir -r requirements.txt

# Security: create an unprivileged user to run the app.
# --home is explicit: `adduser --system` otherwise sets HOME=/nonexistent, and
# libraries that resolve a cache path from HOME then fail or warn on every start.
RUN addgroup --system appgroup \
    && adduser --system --group --home /home/appuser appuser

# Writable cache for the fastembed model, owned by the runtime user. Without it
# the model download fails once the container drops privileges.
ENV HOME=/home/appuser
ENV HF_HOME=/home/appuser/.cache/huggingface
RUN mkdir -p "$HF_HOME" && chown -R appuser:appgroup /home/appuser

# Copy application code
COPY --chown=appuser:appgroup . .

# Drop privileges. This was present but commented out, so every container —
# backend, both workers and beat — ran as root.
USER appuser

# Bake the embedding model into the image.
#
# It was previously fetched on first use, which put a ~130 MB download on the
# critical path of the first request after every deploy and made startup depend
# on HuggingFace being reachable. Downloading it here moves that cost into the
# build, where it is cached, and makes the image self-contained: the container
# needs no third-party host to become healthy.
RUN python -c "\
from fastembed import TextEmbedding; \
TextEmbedding(model_name='BAAI/bge-small-en-v1.5'); \
print('embedding model cached')"

# Worker count is environment, not policy — set WEB_CONCURRENCY to raise it.
# Gunicorn and uvicorn both read that variable natively, so there is no
# --workers flag here and no value baked in.
#
# Unset means one worker, which is deliberate. Each worker loads its OWN copy of
# the embedding model, measured at ~300 MB resident:
#
#   WEB_CONCURRENCY=1 ... 349 MiB   fits a 512 MB host
#   WEB_CONCURRENCY=2 ... 587 MiB   does not
#
# So the default is the one that fits the smallest documented target, and larger
# hosts opt in. Baking in 2 also silently doubled the dev container, because
# uvicorn honours the same variable.
CMD ["gunicorn", "config.asgi:application", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120"]
