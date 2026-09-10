# =============================================================================
# Raphragrance: Multi-Stage Dockerfile
# Stage 1: Build Next.js static export
# Stage 2: Python/Gunicorn runtime serving the built assets
# =============================================================================

# --- Stage 1: Node builder ---------------------------------------------------
FROM node:22-alpine AS node-builder

WORKDIR /build/frontend

# Install dependencies first (layer cache)
COPY frontend/package*.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY frontend/ ./
RUN npm run build


# --- Stage 2: Python runtime -------------------------------------------------
FROM python:3.12-slim AS python-runner

# Metadata labels
LABEL org.opencontainers.image.title="Raphragrance" \
      org.opencontainers.image.description="Fragrance Encyclopedia: Flask + Next.js" \
      org.opencontainers.image.source="https://github.com/raphragrance/raphragrance"

# Create non-root user
RUN groupadd --gid 1001 raphragrance \
    && useradd --uid 1001 --gid 1001 --no-create-home --shell /sbin/nologin raphragrance

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY backend/ ./

# Copy built Next.js static export from node-builder stage
COPY --from=node-builder /build/frontend/out ./frontend_dist

# Set ownership
RUN chown -R raphragrance:raphragrance /app

# Switch to non-root user
USER raphragrance

# Expose application port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/healthz')" || exit 1

# Environment defaults
ENV APP_ENV=production \
    PORT=8080 \
    FRONTEND_DIST=/app/frontend_dist \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Start Gunicorn with 4 workers
CMD ["gunicorn", "wsgi:app", \
     "--bind", "0.0.0.0:8080", \
     "--workers", "4", \
     "--worker-class", "sync", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info"]
