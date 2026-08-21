# Stage 1 — resolve dependencies into a self-contained virtualenv with uv
FROM python:3.12-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

# Stage 2 — slim production runtime
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH"

RUN adduser --disabled-password --gecos "" appuser
WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY . .
RUN chmod +x entrypoint.sh && mkdir -p staticfiles media && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60"]
