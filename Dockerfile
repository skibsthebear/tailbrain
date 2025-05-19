# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files and install dependencies
COPY frontend/package.json ./
COPY frontend/package-lock.json ./
RUN npm install

# Copy the rest of the frontend code
COPY frontend/ ./

# Build the frontend
# The output will be in /app/frontend/dist
RUN npm run build


# Stage 2: Python backend runtime
FROM python:3.9-slim AS backend-runtime

WORKDIR /app

# Install curl if needed by any host commands (original Dockerfile had it)
# For now, assuming it's not directly needed by the Python backend container itself.
# If host commands executed via relay need it on the host, that's separate.
# RUN apt-get update && apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Copy Python backend code and requirements
COPY python_backend/requirements.txt ./python_backend/
COPY python_backend/ ./python_backend/

# Install Python dependencies
RUN pip install --no-cache-dir -r ./python_backend/requirements.txt

# Copy frontend build artifacts from the frontend-builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy the data directory placeholder (or ensure it's created by app.py)
# The app.py creates it, but having it here can help with permissions/ownership if needed.
# For now, relying on app.py to create it.
# COPY data/ ./data/

# Expose the backend port (as defined in python_backend/app.py or env var)
# Default is 7654 for PYTHON_BACKEND_PORT
EXPOSE 7654

# Environment variables
ENV PYTHON_UNBUFFERED=1
ENV FLASK_APP=python_backend.app:app
ENV FLASK_ENV=production # Set to 'development' for debug mode if not using app.run(debug=)
# PYTHON_BACKEND_PORT is used by app.py, defaults to 7654
# HOST_RELAY_URL needs to be set in docker-compose.yml
# FRONTEND_DIST_PATH is derived in app.py relative to itself, should be /app/frontend/dist

# Command to run the Python backend application using Gunicorn
# Ensure Gunicorn is in python_backend/requirements.txt
# The PYTHON_BACKEND_PORT environment variable (default 7654 in app.py) will be used by Gunicorn.
# We can set the port directly here too. Let's use 7654 as per EXPOSE.
CMD ["gunicorn", "--workers", "2", "--bind", "0.0.0.0:7654", "python_backend.app:app"]
